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
