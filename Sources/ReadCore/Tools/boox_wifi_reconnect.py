#!/usr/bin/env python3
"""Reconnect an already trusted BOOX over the configured private LAN endpoint."""
import ipaddress
import shutil
import json
import os
import re
import tempfile
from pathlib import Path
import subprocess
from shelf_config import configuration_section


def reconnect(endpoint, adb=None):
    host, separator, port = str(endpoint).rpartition(':')
    try:
        address = ipaddress.ip_address(host)
        if not separator or not address.is_private or address.is_loopback or not 1 <= int(port) <= 65535:
            return False
    except ValueError:
        return False
    adb = adb or shutil.which('adb') or '/opt/homebrew/bin/adb'
    try:
        devices = subprocess.run([adb, 'devices'], capture_output=True, text=True, timeout=5, check=True)
        rows = [line.split() for line in devices.stdout.splitlines()]
        if [endpoint, 'device'] in rows:
            return True
        # Do not approve new devices or retry an authorization prompt automatically.
        if [endpoint, 'unauthorized'] in rows:
            return False
        result = subprocess.run([adb, 'connect', endpoint], capture_output=True, text=True, timeout=5)
        return result.returncode == 0 and ('connected to '+endpoint) in result.stdout
    except (OSError, subprocess.SubprocessError):
        return False


def usb_wifi_endpoint(serial, adb=None):
    """Re-enable TCP only for the explicitly configured, already trusted USB device."""
    if not serial or ':' in serial:
        return None
    adb = adb or shutil.which('adb') or '/opt/homebrew/bin/adb'
    def run(args):
        return subprocess.run([adb, *args], capture_output=True, text=True, timeout=5, check=True)
    try:
        rows = [line.split() for line in run(['devices']).stdout.splitlines()]
        if [serial, 'device'] not in rows:
            return None
        routes = run(['-s', serial, 'shell', 'ip', 'route']).stdout
        address = next((match.group(1) for line in routes.splitlines()
                        if 'dev wlan0' in line
                        for match in [re.search(r'\bsrc (\d+\.\d+\.\d+\.\d+)', line)] if match), None)
        if not address or not ipaddress.ip_address(address).is_private:
            return None
        port = run(['-s', serial, 'shell', 'getprop', 'service.adb.tcp.port']).stdout.strip()
        if port != '5555':
            run(['-s', serial, 'tcpip', '5555'])
        return address+':5555'
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def remember_endpoint(serial, endpoint):
    path = Path(os.environ.get('SHELF_CONFIG', '~/Library/Application Support/Shelf/config.json')).expanduser()
    try:
        config = json.loads(path.read_text())
        values = config.get('booxWifi', {})
        if values.get('usbSerial') != serial or values.get('endpoint') == endpoint:
            return
        values['endpoint'] = endpoint
        fd, name = tempfile.mkstemp(prefix='.boox-wifi-', dir=path.parent)
        try:
            with os.fdopen(fd, 'w') as output:
                json.dump(config, output, ensure_ascii=False, indent=2)
                output.write('\n')
            os.chmod(name, 0o600)
            os.replace(name, path)
        finally:
            if os.path.exists(name):
                os.unlink(name)
    except (OSError, ValueError, TypeError):
        return


if __name__ == '__main__':
    settings = configuration_section('booxWifi')
    endpoint = usb_wifi_endpoint(settings.get('usbSerial')) or settings.get('endpoint', '')
    if reconnect(endpoint) and settings.get('usbSerial'):
        remember_endpoint(settings['usbSerial'], endpoint)
