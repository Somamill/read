# BOOX Wi-Fi debugging

Reading progress uses KOReader Sync; it does not require an ADB debugging connection. Wi-Fi debugging lets read.'s maintenance tools inspect the tablet and transfer configuration without a cable.

Android 10 requires an initial trusted USB connection to enable TCP debugging. The firmware may reset TCP mode after a reboot. This recovery helper uses a configured, already-authorized USB serial to re-enable TCP mode when USB is next connected. It neither roots the tablet nor approves authorization prompts.

Private configuration in `~/Library/Application Support/Shelf/config.json`:

```json
{"booxWifi":{"endpoint":"10.0.0.20:5555","usbSerial":"YOUR_TRUSTED_USB_SERIAL"}}
```

Use the tablet's current private Wi-Fi address and its serial from `adb devices`. The helper `boox_wifi_reconnect.py` reads this configuration. If the trusted USB device is present, it discovers the Wi-Fi address and checks the TCP debugging port before enabling it. Once connected, it atomically records a changed address. Without USB it retries the last known endpoint. Each subprocess has a five-second timeout; an unauthorized device is never automatically approved.

A user LaunchAgent can run the installed helper every 300 seconds and at login. Healthy checks produce no log output. After reboot, reconnect USB if Wi-Fi debugging is unavailable; the recovery agent re-enables it automatically. If the tablet's DHCP address changes while wireless debugging is inaccessible, reconnect USB to learn the new address.

Reference: [Android's documented USB-to-Wi-Fi debugging procedure](https://developer.android.com/tools/adb#wireless).
