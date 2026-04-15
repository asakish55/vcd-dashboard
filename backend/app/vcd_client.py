"""
VCD Client - VMware Cloud Director API Client
API Version: 37.2 (VCD 10.4.x)
"""

import httpx
import base64
import logging
import xml.etree.ElementTree as ET
from typing import Optional, List, Dict

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)


class VCDClient:

    def __init__(self, host: str, username: str, password: str, org: str = "System"):
        self.host = host.rstrip("/")
        self.username = username
        self.password = password
        self.org = org
        self.token: Optional[str] = None
        self.token_type: str = "Bearer"
        self.api_version: str = "37.2"          # ← גרסת ברירת מחדל
        self.client = httpx.AsyncClient(
            verify=False,
            timeout=httpx.Timeout(60.0, connect=15.0),
        )

    # ──────────────────────────────────────────────────
    # עזר: המרת URN ל-UUID
    # urn:vcloud:org:XXXX  →  XXXX
    # ──────────────────────────────────────────────────

    @staticmethod
    def _urn_to_uuid(urn: str) -> str:
        """מחזיר UUID נקי מתוך URN או UUID."""
        return urn.split(":")[-1] if ":" in urn else urn

    # ──────────────────────────────────────────────────
    # זיהוי גרסת API אוטומטי
    # ──────────────────────────────────────────────────

    async def detect_api_version(self) -> str:
        """
        קורא את /api/versions ובוחר את הגרסה הגבוהה ביותר
        שאינה deprecated. אם נכשל — חוזר ל-37.2.
        """
        try:
            res = await self.client.get(
                f"{self.host}/api/versions",
                headers={"Accept": "application/*+xml"},
                timeout=15.0,
            )
            res.raise_for_status()
            root = ET.fromstring(res.text)
            ns = {"v": "http://www.vmware.com/vcloud/v1.5"}
            versions = []
            for vi in root.findall(".//v:VersionInfo", ns):
                if vi.find("v:Deprecated", ns) is not None:
                    continue
                ver_el = vi.find("v:Version", ns)
                if ver_el is not None and ver_el.text:
                    try:
                        versions.append(float(ver_el.text))
                    except ValueError:
                        pass
            if versions:
                best = str(max(versions))
                if "." not in best:
                    best += ".0"
                logger.info(f"API versions: {sorted(versions)} → using {best}")
                return best
        except Exception as e:
            logger.warning(f"API version detection failed: {e} → using 37.2")
        return "37.2"

    # ──────────────────────────────────────────────────
    # Authentication
    # ──────────────────────────────────────────────────

    async def login(self) -> str:
        # זהה גרסת API אוטומטית
        self.api_version = await self.detect_api_version()

        credentials = base64.b64encode(
            f"{self.username}@{self.org}:{self.password}".encode()
        ).decode()

        try:
            response = await self.client.post(
                f"{self.host}/api/sessions",
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Accept": f"application/*+json;version={self.api_version}",
                },
            )
            response.raise_for_status()
        except httpx.ConnectError:
            raise Exception(f"Cannot connect to {self.host}. Check host URL.")
        except httpx.HTTPStatusError as e:
            code = e.response.status_code
            if code == 401:
                raise Exception("Invalid credentials (username / password / org).")
            raise Exception(f"HTTP {code}: {e.response.text[:300]}")

        if "x-vmware-vcloud-access-token" in response.headers:
            self.token = response.headers["x-vmware-vcloud-access-token"]
            self.token_type = "Bearer"
        elif "x-vcloud-authorization" in response.headers:
            self.token = response.headers["x-vcloud-authorization"]
            self.token_type = "legacy"
        else:
            raise Exception("No auth token in VCD response.")

        logger.info(f"Logged in: {self.username}@{self.host} [API {self.api_version}] [{self.token_type}]")
        return self.token

    def _headers(self, content_type: Optional[str] = None) -> Dict[str, str]:
        h: Dict[str, str] = {
            "Accept": f"application/*+json;version={self.api_version}",
        }
        if self.token_type == "Bearer":
            h["Authorization"] = f"Bearer {self.token}"
        else:
            h["x-vcloud-authorization"] = self.token  # type: ignore
        if content_type:
            h["Content-Type"] = content_type
        return h

    # ──────────────────────────────────────────────────
    # Organizations
    # ──────────────────────────────────────────────────

    async def get_orgs(self) -> List[Dict]:
        """מחזיר את כל ה-Organizations."""
        try:
            res = await self.client.get(
                f"{self.host}/cloudapi/1.0.0/orgs",
                headers=self._headers(),
                params={"pageSize": 100, "page": 1},
            )
            res.raise_for_status()
            orgs = res.json().get("values", [])
            # וודא שיש id ו-name תקניים
            result = []
            for o in orgs:
                oid = o.get("id", "") or o.get("href", "").split("/")[-1]
                result.append({
                    "id": oid,
                    "name": o.get("name", ""),
                    "displayName": o.get("displayName") or o.get("name", ""),
                })
            return result
        except Exception as e:
            logger.warning(f"Cloud API orgs failed ({e}) → legacy /api/org")
            return await self._get_orgs_legacy()

    async def _get_orgs_legacy(self) -> List[Dict]:
        res = await self.client.get(f"{self.host}/api/org", headers=self._headers())
        res.raise_for_status()
        data = res.json()
        orgs = data.get("org", [])
        if isinstance(orgs, dict):
            orgs = [orgs]
        return [
            {
                "id": o["href"].split("/")[-1],
                "name": o.get("name", ""),
                "displayName": o.get("fullName") or o.get("name", ""),
            }
            for o in orgs
        ]

    # ──────────────────────────────────────────────────
    # VDCs
    # ──────────────────────────────────────────────────

    async def get_vdcs_for_org(self, org_id: str) -> List[Dict]:
        """
        מחזיר את כל ה-VDCs של Org מסוים.

        ניסיון 1: Cloud API עם filter לפי org (URN ו-UUID)
        ניסיון 2: Legacy API - קריאה ל-/api/org/{id} וחילוץ לינקים
        ניסיון 3: Query API - /api/query?type=orgVdc&filter=orgName=={name}
        """
        uuid = self._urn_to_uuid(org_id)

        # ── ניסיון 1: Cloud API ──────────────────────────────
        for filter_id in [org_id, f"urn:vcloud:org:{uuid}", uuid]:
            try:
                res = await self.client.get(
                    f"{self.host}/cloudapi/1.0.0/vdcs",
                    headers=self._headers(),
                    params={
                        "pageSize": 100,
                        "filterEncoded": "true",
                        "filter": f"org.id=={filter_id}",
                    },
                )
                res.raise_for_status()
                vdc_list = res.json().get("values", [])
                if vdc_list:
                    logger.info(f"Cloud API found {len(vdc_list)} VDCs for org {filter_id}")
                    return await self._resolve_vdc_list(vdc_list)
            except Exception as e:
                logger.debug(f"Cloud API filter '{filter_id}' failed: {e}")

        # ── ניסיון 2: Legacy org links ───────────────────────
        try:
            vdcs = await self._get_vdcs_from_org_links(uuid)
            if vdcs:
                logger.info(f"Legacy org links found {len(vdcs)} VDCs")
                return vdcs
        except Exception as e:
            logger.warning(f"Legacy org links failed: {e}")

        # ── ניסיון 3: Query API ──────────────────────────────
        try:
            vdcs = await self._get_vdcs_query_api(uuid)
            if vdcs:
                logger.info(f"Query API found {len(vdcs)} VDCs")
                return vdcs
        except Exception as e:
            logger.warning(f"Query API failed: {e}")

        logger.warning(f"No VDCs found for org {org_id} via any method")
        return []

    async def _resolve_vdc_list(self, vdc_list: List[Dict]) -> List[Dict]:
        """מקבל רשימת VDCs מה-Cloud API ומביא פרטים מלאים לכל אחד."""
        result = []
        for v in vdc_list:
            raw_id = v.get("id", "")
            vdc_id = self._urn_to_uuid(raw_id)
            if vdc_id:
                result.append(await self._safe_get_vdc(vdc_id, v.get("name", "Unknown")))
        return result

    async def _get_vdcs_from_org_links(self, org_uuid: str) -> List[Dict]:
        """חולץ VDCs מה-links בתוך תגובת /api/org/{id}."""
        res = await self.client.get(
            f"{self.host}/api/org/{org_uuid}",
            headers=self._headers(),
        )
        res.raise_for_status()
        data = res.json()

        vdcs = []
        links = data.get("link", [])
        if isinstance(links, dict):
            links = [links]

        for link in links:
            href  = link.get("href", "")
            ltype = link.get("type", "").lower()
            lrel  = link.get("rel",  "").lower()

            # קבל VDC links — type מכיל "vdc" או rel הוא "down" עם href מסוג vdc
            is_vdc = (
                ("vdc" in ltype and "/api/vdc/" in href)
                or ("vdc" in href.lower() and lrel == "down")
            )
            if is_vdc and "/api/vdc/" in href:
                vdc_id = href.split("/api/vdc/")[-1].split("?")[0]
                vdcs.append(await self._safe_get_vdc(vdc_id))

        return vdcs

    async def _get_vdcs_query_api(self, org_uuid: str) -> List[Dict]:
        """
        שיטת גיבוי: שימוש ב-Query API של VCD לאיתור VDCs לפי orgId.
        GET /api/query?type=orgVdc&format=json&filter=orgId=={uuid}
        """
        res = await self.client.get(
            f"{self.host}/api/query",
            headers=self._headers(),
            params={
                "type": "orgVdc",
                "format": "json",
                "filter": f"orgId=={org_uuid}",
                "pageSize": 100,
            },
        )
        res.raise_for_status()
        data = res.json()
        records = data.get("record", [])
        if isinstance(records, dict):
            records = [records]

        vdcs = []
        for r in records:
            href = r.get("href", "")
            if "/api/vdc/" in href:
                vdc_id = href.split("/api/vdc/")[-1].split("?")[0]
                vdcs.append(await self._safe_get_vdc(vdc_id, r.get("name", "Unknown")))
        return vdcs

    async def _safe_get_vdc(self, vdc_id: str, fallback_name: str = "Unknown") -> Dict:
        try:
            return await self.get_vdc_details(vdc_id)
        except Exception as e:
            logger.error(f"get_vdc_details({vdc_id}) failed: {e}")
            return {"id": vdc_id, "name": fallback_name, "error": str(e)}

    # ──────────────────────────────────────────────────
    # VDC Details
    # ──────────────────────────────────────────────────

    async def get_vdc_details(self, vdc_id: str) -> Dict:
        res = await self.client.get(
            f"{self.host}/api/vdc/{vdc_id}",
            headers=self._headers(),
        )
        res.raise_for_status()
        data = res.json()

        compute = data.get("computeCapacity", {})
        cpu_info = compute.get("cpu", {})
        mem_info = compute.get("memory", {})

        cpu_limit_mhz = int(cpu_info.get("limit") or 0)
        cpu_used_mhz  = int(cpu_info.get("used")  or 0)
        cpu_alloc_mhz = int(cpu_info.get("allocated") or 0)
        mem_limit_mb  = int(mem_info.get("limit") or 0)
        mem_used_mb   = int(mem_info.get("used")  or 0)

        raw_profiles = data.get("vdcStorageProfile", [])
        if isinstance(raw_profiles, dict):
            raw_profiles = [raw_profiles]

        storage_profiles: List[Dict] = []
        for sp in raw_profiles:
            if not isinstance(sp, dict):
                continue
            limit_mb = int(sp.get("limit") or 0)
            used_mb  = int(sp.get("storageUsedMB") or 0)
            href = sp.get("href", "")
            storage_profiles.append({
                "id":       href.split("/")[-1],
                "name":     sp.get("name", "Unknown"),
                "limit_mb": limit_mb,
                "limit_gb": round(limit_mb / 1024, 1),
                "used_mb":  used_mb,
                "used_gb":  round(used_mb  / 1024, 1),
                "default":  bool(sp.get("default")),
                "enabled":  bool(sp.get("enabled", True)),
            })

        return {
            "id":   vdc_id,
            "name": data.get("name", "Unknown"),
            "description":    data.get("description", ""),
            "status":         int(data.get("status", 0)),
            "allocation_model": data.get("allocationModel", "AllocationVApp"),
            "cpu": {
                "limit_mhz":    cpu_limit_mhz,
                "used_mhz":     cpu_used_mhz,
                "allocated_mhz": cpu_alloc_mhz,
                # 1 vCPU = 2000 MHz (2 GHz)
                "vcpu_count":   max(1, round(cpu_limit_mhz / 2000)) if cpu_limit_mhz else 0,
                "vcpu_used":    round(cpu_used_mhz  / 2000, 1),
                "vcpu_allocated": round(cpu_alloc_mhz / 2000, 1),
            },
            "memory": {
                "limit_mb": mem_limit_mb,
                "used_mb":  mem_used_mb,
                "limit_gb": round(mem_limit_mb / 1024, 1),
                "used_gb":  round(mem_used_mb  / 1024, 1),
            },
            "storage_profiles": storage_profiles,
            "vapp_count": int(data.get("numberOfVApps") or 0),
        }

    # ──────────────────────────────────────────────────
    # Update Resources
    # ──────────────────────────────────────────────────

    async def update_vdc_resources(
        self,
        vdc_id: str,
        cpu_vcpu: Optional[int] = None,
        memory_gb: Optional[int] = None,
    ) -> Dict:
        res = await self.client.get(
            f"{self.host}/api/vdc/{vdc_id}", headers=self._headers()
        )
        res.raise_for_status()
        current = res.json()

        if "computeCapacity" not in current:
            current["computeCapacity"] = {"cpu": {}, "memory": {}}

        if cpu_vcpu is not None:
            current["computeCapacity"]["cpu"]["limit"] = cpu_vcpu * 2000
        if memory_gb is not None:
            current["computeCapacity"]["memory"]["limit"] = memory_gb * 1024

        # שדות read-only שיגרמו לשגיאה אם נשלח אותם
        for field in ("vdcStorageProfile", "resourceEntities", "availableNetworks",
                      "capabilities", "nicQuota", "networkQuota",
                      "usedNetworkCount", "numberOfVApps", "numberOfRunningVMs"):
            current.pop(field, None)

        ct = f"application/vnd.vmware.vcloud.vdc+json;version={self.api_version}"
        put = await self.client.put(
            f"{self.host}/api/vdc/{vdc_id}",
            headers=self._headers(content_type=ct),
            json=current,
        )
        put.raise_for_status()
        return {"success": True, "message": "VDC resources updated successfully"}

    async def update_storage_profile(self, profile_id: str, limit_gb: int) -> Dict:
        res = await self.client.get(
            f"{self.host}/api/vdcStorageProfile/{profile_id}",
            headers=self._headers(),
        )
        res.raise_for_status()
        current = res.json()
        current["limit"] = limit_gb * 1024

        ct = f"application/vnd.vmware.vcloud.vdcStorageProfile+json;version={self.api_version}"
        put = await self.client.put(
            f"{self.host}/api/vdcStorageProfile/{profile_id}",
            headers=self._headers(content_type=ct),
            json=current,
        )
        put.raise_for_status()
        return {"success": True, "message": f"Storage updated to {limit_gb} GB"}

    async def close(self):
        await self.client.aclose()
