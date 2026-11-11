#!/usr/bin/env python3
"""Reconnect an already trusted BOOX over the configured private LAN endpoint."""
import ipaddress
import shutil
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


if __name__ == '__main__':
    reconnect(configuration_section('booxWifi').get('endpoint', ''))
