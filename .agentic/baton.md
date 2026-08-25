# Baton — Issue #10: Recordatorio diario configurable

- Estado: listo para revisión
- Tipo: modificar — convertir la selección estática de onboarding en una preferencia persistida y una notificación local diaria.
- Alcance: `app/(auth)/notifications.tsx`, configuración Expo, inicialización y servicio local de notificaciones; `.agentic/` para el baton.
- Fuera de alcance: Home #8, compartir #11, notificaciones remotas, backend adicional y archivos Convex generados.
- Progreso: se confirmó `expo-notifications` 57.0.14 compatible con SDK 57. La implementación solicita permiso, prepara un canal Android, reemplaza solo recordatorios diarios propios y persiste `reminderHour` mediante `users.updatePreferences`. Para evitar que una notificación repetitiva conserve el contenido de hoy después de medianoche, ahora programa 28 solicitudes locales fechadas: la de hoy usa `devotional.today` y las siguientes `devotional.byDate`; cada cuerpo contiene la referencia real del día.
- Evidencia: `npm run typecheck`, `npm test` (23 pruebas, incluyendo 3 para la ventana de recordatorios) y `npx expo config --type public` correctos tras la corrección.
- Próximo: ejecutar typecheck/tests y, en un development build de iOS/Android, conceder permiso, elegir una hora y confirmar 28 requests con `data.kind = daily-devotional` y referencias por fecha; repetir con otra hora debe reemplazarlos, y “Prefiero sin avisos” debe cancelarlos. La ventana se refresca cuando la persona vuelve a configurar el recordatorio; no se afirma una actualización automática en segundo plano después de los 28 días. Expo Go permite probar notificaciones locales; las remotas requieren development build en Android desde SDK 53.
