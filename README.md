<div align="center">

  # 🌾 Ann (अन्न) — Surplus Food Redistribution Platform

  **Connecting surplus food donors with local NGOs to eliminate hunger and eliminate food waste.**

  [![GitHub Repo](https://img.shields.io/badge/Repository-shubham10442%2Fdev2.0-181717?style=for-the-badge&logo=github)](https://github.com/shubham10442/dev2.0)
  [![Hackathon](https://img.shields.io/badge/Hackathon-DevStorm-6f42c1?style=for-the-badge&logo=github)](https://github.com/shubham10442/dev2.0)
  [![Status](https://img.shields.io/badge/Status-Prototype-orange?style=for-the-badge)](https://github.com/shubham10442/dev2.0)
  [![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://github.com/shubham10442/dev2.0)

  [Live Demo](#) · [Report Bug](https://github.com/shubham10442/dev2.0/issues) · [Request Feature](https://github.com/shubham10442/dev2.0/issues)

</div>

---

## 🚀 About The Project

**Ann (अन्न)** — named after the Hindi word for "grain/food" — is an eco-social web platform designed to streamline the redistribution of excess food from local businesses to charitable organizations.

Engineered as a prototype during the **DevStorm Hackathon** (`dev2.0`), Ann addresses food insecurity and environmental waste by connecting food donors with NGOs through real-time GPS mapping, role-based workflows, and verified OTP handovers.

---

## 👥 DevStorm Team & Contributors

Designed and engineered for **DevStorm Hackathon** by:

| Contributor | Role | GitHub Profile |
| :--- | :--- | :---: |
| 🧑‍💻 **Shubham Kumar** | Full Stack / Project Lead | [@shubham10442](https://github.com/shubham10442) |
| 👨‍💻 **Manas Kumar Mehta** | Frontend Developer | [Profile](#) |
| 🧑‍💻 **Sumit Kumar Parsad** | Backend Developer | [Profile](#) |
| 👩‍💻 **Simran Singh** | UI/UX & Documentation | [Profile](#) |

---

## ✨ Key Features

- 🔐 **Dual Login Portal:** Customized onboarding and authentication flows for Donors and NGOs, backed by JWT middleware.
- 📦 **Surplus Food Listings:** Donors post available food with details like quantity, food type, expiry timestamp, pickup window, and precise pickup location.
- 🤝 **OTP Claiming System:** NGOs search and claim listings; pickup verification is secured using a **6-digit OTP**.
- 📍 **GPS Location Mapping:** Integrated **Leaflet.js** for real-time map-based pickup discovery and navigation.
- 📊 **Rich Admin Dashboard:** An interactive React component (`AdminDashboard.tsx`) providing:
  - 🍲 **KPI Analytics:** Rescued meals counter, CO₂ offset calculator, and claim completion rates.
  - 👥 **User Management:** Account status moderation and role provisioning.
  - 🛡️ **Audit Logs:** Full administrative action tracking with before/after state metadata.
- ⚙️ **System Settings:** Configurable operational parameters for global platform control.

---

## 👥 User Roles

| Role | Responsibilities |
| :--- | :--- |
| 👑 **Super Admin / Admin** | Complete platform oversight, KPI analytics, user management, listing moderation, and audit logging |
| 🚚 **Dispatcher** | Route management and logistics coordination |
| 🍲 **Donor** | Restaurants and food businesses listing surplus meals |
| 🏛️ **NGO** | Charitable organizations claiming and distributing meals |

---

## 🛠️ Architecture & Tech Stack

<div align="left">

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) ![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB) ![Leaflet](https://img.shields.io/badge/Leaflet.js-199900?style=flat-square&logo=leaflet&logoColor=white) |
| **Backend** | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white) ![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=json-web-tokens&logoColor=white) |
| **Database & ORM** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white) |

</div>

---

## 📁 Repository Structure

```text
dev2.0/
├── index.html              # Main multi-view SPA frontend
├── app.js                  # Core client-side JavaScript logic
├── style.css               # Custom UI styling
├── backend/
│   ├── prisma/
│   │   └── schema.prisma   # PostgreSQL database models
│   └── src/
│       ├── middleware/     # auth.js & validate.js
│       └── routes/         # admin.js API endpoints
└── frontend/
    └── components/
        └── AdminDashboard.tsx # React admin analytics & moderation panel
