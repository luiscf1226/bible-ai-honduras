# Baton — Issue #10: Recordatorio diario configurable

- Estado: listo para revisión
- Tipo: modificar — convertir la selección estática de onboarding en una preferencia persistida y una notificación local diaria.
- Alcance: `app/(auth)/notifications.tsx`, configuración Expo, inicialización y servicio local de notificaciones; `.agentic/` para el baton.
- Fuera de alcance: Home #8, compartir #11, notificaciones remotas, backend adicional y archivos Convex generados.
- Progreso: se confirmó `expo-notifications` 57.0.14 compatible con SDK 57. La implementación solicita permiso, prepara un canal Android, reemplaza solo recordatorios diarios propios, programa el disparador diario correspondiente por plataforma y persiste `reminderHour` mediante `users.updatePreferences`.
- Evidencia: `npm run typecheck`, `npm test` (20 pruebas) y `npx expo config --type public` correctos después del cambio; el último confirma el plugin `expo-notifications`.
- Próximo: en un development build de iOS/Android, conceder permiso, elegir una hora y confirmar un único request diario con `data.kind = daily-devotional`; repetir con otra hora debe reemplazarlo, y “Prefiero sin avisos” debe cancelarlo. Expo Go permite probar notificaciones locales; las remotas requieren development build en Android desde SDK 53.
