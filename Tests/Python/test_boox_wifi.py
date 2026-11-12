import sys,unittest,subprocess
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'Sources/ReadCore/Tools'))
from boox_wifi_reconnect import reconnect
class WifiTests(unittest.TestCase):
    def test_public_endpoint_is_never_contacted(self):
        with patch('boox_wifi_reconnect.subprocess.run') as run:
            self.assertFalse(reconnect('8.8.8.8:5555'));run.assert_not_called()
    def test_trusted_connected_device_does_not_reconnect(self):
        with patch('boox_wifi_reconnect.subprocess.run',return_value=subprocess.CompletedProcess([],0,'10.0.1.37:5555\tdevice\n')) as run:
            self.assertTrue(reconnect('10.0.1.37:5555'));self.assertEqual(run.call_count,1)
    def test_never_approves_an_unauthorized_device(self):
        with patch('boox_wifi_reconnect.subprocess.run',return_value=subprocess.CompletedProcess([],0,'10.0.1.37:5555\tunauthorized\n')) as run:
            self.assertFalse(reconnect('10.0.1.37:5555'));self.assertEqual(run.call_count,1)
    def test_connection_attempt_has_timeout(self):
        with patch('boox_wifi_reconnect.subprocess.run',side_effect=[subprocess.CompletedProcess([],0,'List of devices attached\n'),subprocess.TimeoutExpired('adb',5)]) as run:
            self.assertFalse(reconnect('10.0.1.37:5555'));self.assertEqual(run.call_args.kwargs['timeout'],5)

class UsbWifiTests(unittest.TestCase):
    def test_only_configured_authorized_serial_is_used(self):
        from boox_wifi_reconnect import usb_wifi_endpoint
        with patch('boox_wifi_reconnect.subprocess.run',return_value=subprocess.CompletedProcess([],0,'other\tdevice\n')) as run:
            self.assertIsNone(usb_wifi_endpoint('trusted'));self.assertEqual(run.call_count,1)
    def test_rearms_tcp_after_usb_reboot_and_learns_wifi_ip(self):
        from boox_wifi_reconnect import usb_wifi_endpoint
        replies=['trusted\tdevice\n','10.0.0.0/8 dev wlan0 src 10.0.1.42\n','-1\n','restarting in TCP mode port: 5555\n']
        with patch('boox_wifi_reconnect.subprocess.run',side_effect=[subprocess.CompletedProcess([],0,x) for x in replies]) as run:
            self.assertEqual(usb_wifi_endpoint('trusted',adb='adb'),'10.0.1.42:5555')
            self.assertEqual(run.call_args.args[0],['adb','-s','trusted','tcpip','5555'])
    def test_running_tcp_service_is_not_restarted(self):
        from boox_wifi_reconnect import usb_wifi_endpoint
        replies=['trusted\tdevice\n','10.0.0.0/8 dev wlan0 src 10.0.1.42\n','5555\n']
        with patch('boox_wifi_reconnect.subprocess.run',side_effect=[subprocess.CompletedProcess([],0,x) for x in replies]) as run:
            self.assertEqual(usb_wifi_endpoint('trusted'),'10.0.1.42:5555');self.assertEqual(run.call_count,3)
    def test_endpoint_update_preserves_configuration_and_requires_matching_serial(self):
        import json,os,tempfile
        from boox_wifi_reconnect import remember_endpoint
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'config.json';path.write_text(json.dumps({'booxWifi':{'usbSerial':'trusted','endpoint':'10.0.1.2:5555'},'services':{'keep':'unchanged'}}))
            with patch.dict(os.environ,{'SHELF_CONFIG':str(path)}):
                remember_endpoint('other','10.0.1.3:5555')
                self.assertEqual(json.loads(path.read_text())['booxWifi']['endpoint'],'10.0.1.2:5555')
                remember_endpoint('trusted','10.0.1.3:5555')
                result=json.loads(path.read_text());self.assertEqual(result['booxWifi']['endpoint'],'10.0.1.3:5555');self.assertEqual(result['services'],{'keep':'unchanged'});self.assertEqual(path.stat().st_mode&0o777,0o600)
