import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import urllib.error
import io
from unittest.mock import patch

TOOLS=Path(__file__).resolve().parents[2]/'Sources/ReadCore/Tools'
sys.path.insert(0,str(TOOLS))
spec=importlib.util.spec_from_file_location('runtime_watchdog',TOOLS/'sync_runtime_watchdog.py')
watchdog=importlib.util.module_from_spec(spec)
spec.loader.exec_module(watchdog)

class RuntimeTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.object(watchdog, 'configuration_section', return_value={})
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_calibre_auth_challenge_is_healthy(self):
        config = {'services':{'calibreOpds':'http://127.0.0.1:8080/opds'}, 'launchAgents':{'calibre':'test.calibre'}}
        error = urllib.error.HTTPError(config['services']['calibreOpds'], 401, 'Login required', {}, io.BytesIO())
        with tempfile.TemporaryDirectory() as root, patch.object(watchdog,'STATE',Path(root)), patch.object(watchdog,'configuration_section',side_effect=lambda key:config[key]), patch.object(watchdog.urllib.request,'urlopen',side_effect=error), patch.object(watchdog,'command') as command:
            watchdog.check_calibre()
            command.assert_not_called()
            self.assertIn('"offline": false', (Path(root)/'calibre-runtime-health.json').read_text())

    def test_calibre_recovers_after_two_failures_and_obeys_cooldown(self):
        config = {'services':{'calibreOpds':'http://127.0.0.1:8080/opds'}, 'launchAgents':{'calibre':'test.calibre'}}
        with tempfile.TemporaryDirectory() as root, patch.object(watchdog,'STATE',Path(root)), patch.object(watchdog,'LOGS',Path(root)), patch.object(watchdog,'configuration_section',side_effect=lambda key:config[key]), patch.object(watchdog.urllib.request,'urlopen',side_effect=TimeoutError), patch.object(watchdog,'command',return_value=subprocess.CompletedProcess([],0)) as command:
            watchdog.check_calibre()
            command.assert_not_called()
            watchdog.check_calibre()
            command.assert_called_once_with(['/bin/launchctl','kickstart','-k',f'gui/{watchdog.os.getuid()}/test.calibre'],timeout=15)
            watchdog.check_calibre()
            self.assertEqual(command.call_count,1)

    def test_remote_calibre_is_never_restarted(self):
        config = {'services':{'calibreOpds':'https://example.org/opds'}, 'launchAgents':{'calibre':'test.calibre'}}
        with patch.object(watchdog,'configuration_section',side_effect=lambda key:config[key]), patch.object(watchdog.urllib.request,'urlopen') as request, patch.object(watchdog,'command') as command:
            watchdog.check_calibre()
            request.assert_not_called()
            command.assert_not_called()

    def test_healthy_services_do_not_start_docker_or_log(self):
        with tempfile.TemporaryDirectory() as root,patch.object(watchdog,'STATE',Path(root)/'state'),patch.object(watchdog,'LOGS',Path(root)/'logs'),patch.object(watchdog,'healthy',return_value=True),patch.object(watchdog,'command') as command:
            watchdog.main()
            command.assert_not_called()
            self.assertFalse((watchdog.LOGS/'sync-runtime.log').exists())

    def test_retry_backoff_does_not_wake_docker(self):
        with tempfile.TemporaryDirectory() as root,patch.object(watchdog,'STATE',Path(root)),patch.object(watchdog,'LOGS',Path(root)),patch.object(watchdog,'healthy',return_value=False),patch.object(watchdog,'command') as command:
            watchdog.save(Path(root)/'sync-runtime-health.json',{'retryAfter':watchdog.time.time()+600})
            watchdog.main()
            command.assert_not_called()
