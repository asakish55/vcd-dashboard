# ☁️ VCD Dashboard – VMware Cloud Director Resource Manager

מערכת ניהול משאבים ל-VMware Cloud Director עם ממשק ווב מודרני.

---

## 📋 תוכן עניינים

1. [מה המערכת עושה](#מה-המערכת-עושה)
2. [ארכיטקטורת המערכת](#ארכיטקטורת-המערכת)
3. [דרישות מוקדמות](#דרישות-מוקדמות)
4. [עבודה עם Git – מדריך למתחיל](#עבודה-עם-git--מדריך-למתחיל)
5. [התקנה על שרת Ubuntu](#התקנה-על-שרת-ubuntu)
6. [הורדת הקוד מ-GitHub](#הורדת-הקוד-מ-github)
7. [הגדרת קבצי תצורה](#הגדרת-קבצי-תצורה)
8. [הרצת המערכת עם Docker](#הרצת-המערכת-עם-docker)
9. [שימוש ב-Dashboard](#שימוש-ב-dashboard)
10. [הסבר על כל קובץ](#הסבר-על-כל-קובץ)
11. [פתרון בעיות](#פתרון-בעיות)

---

## מה המערכת עושה

VCD Dashboard הוא ממשק ווב שמאפשר למנהל מערכת:

- **התחברות ל-VCD** – הכנסת כתובת ה-VCD, שם משתמש וסיסמה דרך הדפדפן
- **הצגת כל ה-Organizations** – רשימה של כל ה-Orgs במערכת
- **צפייה במשאבי VDC** – לכל Org מוצגים VDCs עם:
  - **CPU** – מספר vCPUs (1 vCPU = 2 GHz)
  - **זיכרון** – בGB עם סרגל שימוש
  - **Storage Policies** – כל Policy עם מגבלה ושימוש בGB
- **עריכת משאבים** – הגדלה/הפחתה של CPU, זיכרון ואחסון לכל VDC
- **ממשק חזותי** – Progress bars שמשתנים בצבע לפי רמת שימוש

---

## ארכיטקטורת המערכת

```
┌─────────────────────────────────────────┐
│              Docker Host (Ubuntu)        │
│                                         │
│  ┌──────────────┐   ┌───────────────┐  │
│  │   Frontend   │   │    Backend    │  │
│  │  (Nginx +    │──▶│  (Python /   │  │
│  │   React)     │   │   FastAPI)   │  │
│  │  Port: 80    │   │  Port: 8000  │  │
│  └──────────────┘   └───────┬───────┘  │
│                             │           │
└─────────────────────────────┼───────────┘
                              │ HTTPS/API
                              ▼
                    ┌──────────────────┐
                    │  VMware Cloud    │
                    │  Director (VCD)  │
                    │  REST API v36+   │
                    └──────────────────┘
```

---

## דרישות מוקדמות

| דרישה | גרסה מינימלית | הערות |
|-------|--------------|-------|
| Ubuntu Server | 20.04 LTS+ | 22.04 מומלץ |
| Docker | 24.0+ | Docker Engine |
| Docker Compose | 2.20+ | כלול ב-Docker Desktop |
| Git | 2.30+ | לניהול קוד |
| RAM | 2 GB+ | מינימום לשרת |
| Disk | 10 GB+ | לאחסון images |

---

## עבודה עם Git – מדריך למתחיל

### מה זה Git?

Git הוא מערכת לניהול גרסאות קוד. במקום לשמור קבצים כ`file_v1`, `file_v2_final`, `file_FINAL_REAL`, Git שומר **היסטוריה מסודרת** של כל שינוי בקוד.

**GitHub** הוא אתר שמאחסן repositories (מאגרי קוד) של Git בענן – כמו "Google Drive לקוד".

### פקודות Git בסיסיות

```bash
# הורדת repository מ-GitHub למחשב/שרת
git clone <URL>

# בדיקת סטטוס הקבצים
git status

# הוספת קבצים לstaging (הכנה לcommit)
git add .                     # הוסף הכל
git add filename.py           # הוסף קובץ ספציפי

# שמירת שינויים (commit)
git commit -m "תיאור השינוי"

# שליחת שינויים ל-GitHub
git push

# הורדת עדכונים מ-GitHub
git pull
```

### הגדרת Git בפעם הראשונה (חייב לבצע פעם אחת)

```bash
# הגדרת שם ואימייל (יופיעו ב-commits)
git config --global user.name "Yossi"
git config --global user.email "asakish@gmail.com"

# בדיקה שההגדרות נשמרו
git config --list
```

---

## התקנה על שרת Ubuntu

### שלב 1 – עדכון המערכת

```bash
# עדכון רשימת החבילות
sudo apt update

# עדכון חבילות קיימות
sudo apt upgrade -y
```

### שלב 2 – התקנת Docker

```bash
# הורדת סקריפט ההתקנה הרשמי
curl -fsSL https://get.docker.com -o get-docker.sh

# הרצת הסקריפט
sudo sh get-docker.sh

# הוספת המשתמש שלך לקבוצת docker (כדי שלא יצטרך sudo)
sudo usermod -aG docker $USER

# החל את השינוי (או התנתק והתחבר מחדש)
newgrp docker

# בדיקה שהכל עובד
docker --version
# אמור להציג: Docker version 27.x.x, build...
```

### שלב 3 – בדיקת Docker Compose

```bash
# Docker Compose כלול מגרסה 20+ של Docker
docker compose version
# אמור להציג: Docker Compose version v2.x.x
```

### שלב 4 – התקנת Git

```bash
sudo apt install git -y

# בדיקה
git --version
# אמור להציג: git version 2.x.x
```

---

## הורדת הקוד מ-GitHub

### שיטה 1 – HTTPS (הכי פשוט, מומלץ למתחילים)

```bash
# מעבר לתיקיית הבית
cd ~

# הורדת הפרויקט
git clone https://github.com/asakish55/vcd-dashboard.git

# כניסה לתיקיית הפרויקט
cd vcd-dashboard

# בדיקה שכל הקבצים הורדו
ls -la
```

**פלט צפוי:**
```
total 48
drwxr-xr-x 5 ubuntu ubuntu 4096 Apr  2 10:00 .
drwxr-xr-x 8 ubuntu ubuntu 4096 Apr  2 10:00 ..
-rw-r--r-- 1 ubuntu ubuntu  892 Apr  2 10:00 .env.example
-rw-r--r-- 1 ubuntu ubuntu  445 Apr  2 10:00 .gitignore
drwxr-xr-x 3 ubuntu ubuntu 4096 Apr  2 10:00 backend
drwxr-xr-x 4 ubuntu ubuntu 4096 Apr  2 10:00 frontend
-rw-r--r-- 1 ubuntu ubuntu 1234 Apr  2 10:00 docker-compose.yml
-rw-r--r-- 1 ubuntu ubuntu  678 Apr  2 10:00 Makefile
-rw-r--r-- 1 ubuntu ubuntu 8000 Apr  2 10:00 README.md
```

### שיטה 2 – עדכון קוד קיים (אם כבר הורדת בעבר)

```bash
cd ~/vcd-dashboard
git pull
```

---

## הגדרת קבצי תצורה

### קובץ `.env` – הגדרות סביבה

קובץ זה מכיל פרמטרים כלליים. **ניתן לדלג עליו** כי ההתחברות ל-VCD נעשית דרך ממשק הווב.

```bash
# העתק את קובץ הדוגמה
cp .env.example .env

# ערוך אם צריך (אופציונלי)
nano .env
```

**תוכן הקובץ ומה אפשר לשנות:**

```env
# כתובת ברירת המחדל של VCD (רק לתיעוד – לא בשימוש)
VCD_HOST=https://your-vcd-host.example.com

# הפורט שב-Dashboard יהיה נגיש
FRONTEND_PORT=80        # ← שנה אם פורט 80 תפוס, למשל ל-8080

# רמת לוגים
LOG_LEVEL=info          # ← שנה ל-debug לצורך פתרון בעיות
```

### קובץ `docker-compose.yml` – הגדרות Docker

**קובץ זה בדרך כלל לא דורש שינוי.**
שורות חשובות להבנה:

```yaml
services:
  backend:
    # ...
    # אם רוצים לחשוף את ה-API ישירות (לdebug), בטל את ההערה:
    # ports:
    #   - "8000:8000"

  frontend:
    ports:
      - "80:80"         # ← שנה ל-"8080:80" אם 80 תפוס
```

**דוגמה לשינוי פורט:**
```yaml
# אם פורט 80 תפוס:
ports:
  - "8080:80"
# ואז גש ל: http://<שרת>:8080
```

### קובץ `frontend/nginx.conf` – הגדרות שרת הווב

**בדרך כלל לא דורש שינוי.** רלוונטי רק אם:
- מוסיפים HTTPS
- משנים את כתובת ה-backend

```nginx
location /api/ {
    proxy_pass http://backend:8000;   # ← שם השירות ב-Docker (אל תשנה)
}
```

### קובץ `backend/app/vcd_client.py` – הגדרות API

**שורה חשובה שאפשר להתאים:**

```python
self.api_version: str = "36.2"
```

| VCD Version | API Version |
|-------------|------------|
| VCD 10.3.x  | 36.2       |
| VCD 10.4.x  | 37.2       |
| VCD 10.5.x  | 38.0       |

אם ה-VCD שלך ישן יותר (לפני 10.3), שנה לגרסה מתאימה.

---

## הרצת המערכת עם Docker

### 🚀 הרצה ראשונה (Production)

```bash
# ודא שאתה בתיקיית הפרויקט
cd ~/vcd-dashboard

# בנייה והרצה של כל הcontainers
docker compose up -d

# --- פלט צפוי ---
# [+] Building 45.2s (18/18) FINISHED
# [+] Running 3/3
#  ✔ Network vcd-dashboard-network  Created
#  ✔ Container vcd-backend          Started
#  ✔ Container vcd-frontend         Started
```

**זמן בנייה ראשוני:** 3-5 דקות (מוריד images והתקנות)

### בדיקת סטטוס

```bash
docker compose ps
```

**פלט צפוי:**
```
NAME           IMAGE              STATUS        PORTS
vcd-backend    vcd-backend        Up (healthy)  8000/tcp
vcd-frontend   vcd-frontend       Up (healthy)  0.0.0.0:80->80/tcp
```

הסטטוס `Up (healthy)` אומר שהכל תקין ✅

### גישה ל-Dashboard

פתח דפדפן וגש ל:
```
http://<IP-של-השרת>
```

למשל: `http://192.168.1.100`

### פקודות שימושיות

```bash
# צפייה בלוגים בזמן אמת
docker compose logs -f

# הפסקה
docker compose stop

# הפעלה מחדש
docker compose start

# עצירה מוחלטת
docker compose down

# בנייה מחדש אחרי שינויים בקוד
docker compose build --no-cache
docker compose up -d
```

### שימוש ב-Makefile (קיצור דרך)

```bash
make start      # הפעל
make stop       # עצור
make logs       # לוגים
make rebuild    # בנה מחדש והפעל
make status     # בדוק סטטוס
make clean      # נקה הכל
```

---

## שימוש ב-Dashboard

### שלב 1 – התחברות ל-VCD

מלא את הפרטים:

| שדה | ערך לדוגמה | הסבר |
|-----|-----------|------|
| VCD Host URL | `https://vcd.mycompany.com` | כתובת ה-VCD כולל https:// |
| Organization | `System` | Provider admin = System, Tenant admin = שם הOrg |
| Username | `administrator` | שם המשתמש ב-VCD |
| Password | `*****` | הסיסמה |

### שלב 2 – בחירת Organization

ברשימה השמאלית יוצגו כל ה-Organizations. לחץ על Org כדי לטעון את ה-VDCs שלה.

### שלב 3 – עריכת משאבים

לחץ על **✏️ Edit** בכרטיסיית VDC. ניתן לשנות:

- **⚡ CPU**: כפתורי +/- להגדלה/הפחתה של vCPUs (כל יחידה = 2 GHz)
- **🧠 Memory**: כפתורי +/- להגדלה/הפחתה בGB
- **💾 Storage**: כפתורי +/- להגדלה/הפחתה ב-100GB לבת (ניתן לרשום ידנית)

### פירוש סרגלי ההתקדמות (Progress Bars)

| צבע | משמעות |
|-----|--------|
| 🔵 כחול/ירוק | שימוש תקין (מתחת ל-50%) |
| 🟡 צהוב | שימוש בינוני (50-75%) |
| 🟠 כתום | שימוש גבוה (75-90%) |
| 🔴 אדום | שימוש קריטי (90%+) |

---

## הסבר על כל קובץ

```
vcd-dashboard/
│
├── backend/                      # שרת ה-API (Python)
│   ├── app/
│   │   ├── __init__.py           # קובץ ריק הנדרש ע"י Python
│   │   ├── main.py               # ← נקודת הכניסה של ה-API
│   │   │                         #   מגדיר את כל ה-endpoints:
│   │   │                         #   POST /api/login
│   │   │                         #   GET  /api/orgs
│   │   │                         #   GET  /api/orgs/{id}/vdcs
│   │   │                         #   PUT  /api/vdcs/{id}
│   │   │                         #   PUT  /api/storage-profiles/{id}
│   │   │
│   │   └── vcd_client.py         # ← לוגיקת ה-VCD API
│   │                             #   אימות, קריאת ORGs, VDCs, עדכון משאבים
│   │
│   ├── requirements.txt          # חבילות Python הנדרשות
│   └── Dockerfile                # הוראות בנייה של container ה-backend
│
├── frontend/                     # ממשק המשתמש (React)
│   ├── src/
│   │   ├── main.jsx              # ← נקודת כניסה של React
│   │   ├── App.jsx               # ← כל ה-UI: Login, Dashboard, Modal, Cards
│   │   └── index.css             # ← עיצוב בסיסי (Tailwind CSS)
│   │
│   ├── index.html                # עמוד HTML בסיסי (React נטען לתוכו)
│   ├── package.json              # חבילות JavaScript
│   ├── vite.config.js            # ← הגדרות Vite (כולל proxy ל-backend)
│   ├── tailwind.config.js        # הגדרות Tailwind CSS
│   ├── postcss.config.js         # כלי עיבוד CSS
│   ├── nginx.conf                # ← הגדרות Nginx (proxy, caching)
│   └── Dockerfile                # בנייה: Vite build → Nginx
│
├── docker-compose.yml            # ← הגדרות הרצת Docker (production)
│                                 #   מגדיר: backend + frontend + network
│
├── docker-compose.dev.yml        # הגדרות פיתוח (hot-reload)
├── .env.example                  # ← דוגמה להגדרות סביבה (העתק ל-.env)
├── .gitignore                    # קבצים שGit לא ישמור
├── Makefile                      # קיצורי דרך לפקודות Docker
└── README.md                     # קובץ זה
```

---

## פתרון בעיות

### בעיה: "Cannot connect to VCD"

**סיבות אפשריות:**
1. כתובת VCD שגויה – ודא שכוללת `https://`
2. פורט חסום – בדוק firewall
3. אישור SSL עצמי חתום – המערכת מוגדרת לקבל (verify=False)

```bash
# בדיקת connectivity מהשרת
curl -k https://your-vcd-host.com/api/versions
```

### בעיה: "401 Invalid credentials"

- ודא שה-**Organization** נכון (לא שם Org של טנאנט – אלא "System")
- פורמט: `username@org` (הלקוח מחבר אוטומטית)

### בעיה: Containers לא עולים

```bash
# ראה לוגים מפורטים
docker compose logs -f

# לוגי backend בלבד
docker compose logs backend

# לוגי frontend בלבד
docker compose logs frontend
```

### בעיה: פורט 80 תפוס

```bash
# בדוק מה תופס את הפורט
sudo ss -tlnp | grep :80

# אם Apache/Nginx רץ על השרת:
sudo systemctl stop apache2   # אם Apache
sudo systemctl stop nginx     # אם Nginx standalone
```

או שנה פורט ב-`docker-compose.yml`:
```yaml
ports:
  - "8080:80"   # במקום 80:80
```

### בעיה: נפח דיסק מלא

```bash
# ניקוי images לא בשימוש
docker system prune -a

# בדיקת נפח
docker system df
```

### API בדיקת תקינות

גש ל: `http://<server>/api/health`

פלט תקין:
```json
{"status": "ok", "version": "1.0.0", "sessions": 0}
```

Swagger UI (תיעוד API מלא):
```
http://<server>/api/docs
```

---

## אחרי שינוי קוד – כיצד לעדכן

```bash
# 1. עדכן קוד מ-GitHub
git pull

# 2. בנה מחדש את ה-images
docker compose build --no-cache

# 3. הפעל מחדש
docker compose up -d
```

---

## רישיון

MIT License – חופשי לשימוש, שינוי והפצה.

---

*VCD Dashboard v1.0 | github.com/asakish55/vcd-dashboard*
