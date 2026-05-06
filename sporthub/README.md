# 🏆 SportConnect

Plataforma de conexión deportiva con login por email, dashboard admin en tiempo real y diseño de última generación.

---

## 🚀 Deploy en Netlify

1. **Sube la carpeta** `sportconnect/` a un repositorio en GitHub.
2. Ve a [app.netlify.com](https://app.netlify.com) → "Add new site" → "Import from Git".
3. Selecciona tu repositorio y deja los settings por defecto (la carpeta raíz ya tiene `netlify.toml`).
4. ¡Deploy!

---

## 🔥 Configurar Firebase (obligatorio para guardar datos)

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un proyecto nuevo (ej. `sportconnect-prod`)
3. Activa **Firestore Database** → modo producción
4. Ve a Configuración del proyecto → **"Agregar aplicación Web"**
5. Copia el objeto `firebaseConfig` que te da Firebase
6. Pégalo en `app.js` reemplazando el bloque que dice `// 🔧 Reemplaza estos valores`

### Reglas de Firestore (pegar en la consola)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{doc} {
      allow create: true;
      allow read: if request.auth != null;
    }
  }
}
```

---

## 👑 Acceso Admin

Para ver el dashboard de administración en tiempo real, entra con este email exacto:

```
admin@sportconnect.com
```

(Cámbialo en `app.js` → variable `ADMIN_EMAIL`)

---

## 📱 Funcionalidades

| Feature | Descripción |
|---|---|
| 🔐 Login sin contraseña | Solo nombre + apellidos + email |
| 👑 Dashboard Admin | Tiempo real con Firebase onSnapshot |
| 📊 Métricas KPI | Total, hoy, activos |
| 📡 Feed en vivo | Registro de cada nuevo usuario |
| 📈 Gráfica de actividad | Canvas 2D con curvas Bézier |
| 🏆 Demo mode | Funciona sin Firebase con datos simulados |

---

## 🎨 Tecnologías

- **HTML/CSS/JS puro** — sin frameworks
- **Firebase 10** (Firestore) — base de datos en tiempo real
- **Netlify** — hosting y CDN
- **Canvas 2D** — gráficas de actividad

---

*Hecho con ❤️ para deportistas* 🎾
