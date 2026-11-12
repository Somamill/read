import { useState } from "react";
import notices from "../../assets/third-party-notices.json";
import { Linking } from 'react-native';
import { Button, Card, Label } from './UI';
import { useRead } from '../lib/context';
export function PrivacyAndSupport() {
  const { report } = useRead();
  const [showLicenses, setShowLicenses] = useState(false);
  return <Card><Label>Privacy & support</Label><Label>Books, articles, highlights and reading progress are stored on this device. read. has no advertising or analytics.</Label><Label>Connections are optional. When you enable a library server, Readwise or Hardcover, the app sends the data needed for that service directly to the address you choose. Opening feeds, covers and article links contacts their hosts. Those services apply their own privacy policies.</Label><Label>Passwords and tokens use the system’s secure storage. Device backups follow your Apple settings. Remove books and highlights in the app; deleting the app removes its local library. Secure system credentials may persist after reinstall.</Label><Button secondary title="Read the privacy policy" onPress={() => Linking.openURL('https://github.com/Somamill/read/blob/main/PRIVACY.md').catch(report)} /><Button secondary title="Contact support" onPress={() => Linking.openURL('mailto:k4jenx@gmail.com?subject=read.%20Store%20support').catch(report)} /><Button secondary title={showLicenses ? "Hide software licenses" : "Software licenses"} onPress={() => setShowLicenses(!showLicenses)} />{showLicenses && <Label>{notices.text}</Label>}</Card>;
}
