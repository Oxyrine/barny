import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNetsh, parseAirport, parseNmcli } from "./wifi.ts";

const NETSH_SAMPLE = `
There is 1 interface on the system:

    Name                   : Wi-Fi
    Description            : MediaTek MT7921 Wi-Fi 6 802.11ax PCIe Adapter
    GUID                   : 6616b707-af7a-4951-8dc1-be868c14e5c7
    Physical address       : 04:f7:b5:bb:1a:83
    Interface type         : Primary
    State                  : connected
    SSID                   : Redmi 9 Power
    AP BSSID               : 56:dd:8c:45:e5:fa
    Band                   : 5 GHz
    Channel                : 44
    Network type           : Infrastructure
    Radio type             : 802.11ax
    Authentication         : WPA2-Personal
    Cipher                 : CCMP
    Connection mode        : Profile
    Receive rate (Mbps)    : 1201
    Transmit rate (Mbps)   : 1201
    Signal                 : 90%
    Rssi                   : -37
    Profile                : Redmi 9 Power
`;

test("parseNetsh extracts real fields, reports SNR unavailable", () => {
  const info = parseNetsh(NETSH_SAMPLE);
  assert.equal(info.ssid, "Redmi 9 Power");
  assert.equal(info.bssid, "56:dd:8c:45:e5:fa");
  assert.equal(info.rssi, -37);
  assert.equal(info.channel, 44);
  assert.equal(info.band, "5GHz");
  assert.equal(info.radioType, "802.11ax");
  assert.equal(info.snr, null);
  assert.equal(info.snrSource, "unavailable");
});

test("parseNetsh does not throw on empty/garbage input", () => {
  const info = parseNetsh("not wifi data at all");
  assert.equal(info.ssid, null);
  assert.equal(info.rssi, null);
});

const AIRPORT_SAMPLE = `
     agrCtlRSSI: -50
     agrExtRSSI: 0
    agrCtlNoise: -92
    agrExtNoise: 0
          state: running
        op mode: station
     lastTxRate: 400
        maxRate: 400
lastAssocStatus: 0
    802.11 auth: open
      link auth: wpa2-psk
          BSSID: aa:bb:cc:dd:ee:ff
           SSID: TestNet
            MCS: 9
        channel: 149,1
`;

test("parseAirport derives real SNR from RSSI - noise", () => {
  const info = parseAirport(AIRPORT_SAMPLE);
  assert.equal(info.ssid, "TestNet");
  assert.equal(info.bssid, "aa:bb:cc:dd:ee:ff");
  assert.equal(info.rssi, -50);
  assert.equal(info.snr, 42);
  assert.equal(info.snrSource, "measured");
  assert.equal(info.channel, 149);
  assert.equal(info.band, "5GHz");
});

const NMCLI_SAMPLE =
  "no:OtherNet:11\\:22\\:33\\:44\\:55\\:66:6:2437 MHz:40\n" +
  "yes:HomeNet:aa\\:bb\\:cc\\:dd\\:ee\\:ff:6:2437 MHz:80\n";

test("parseNmcli picks the active connection line and unescapes the BSSID", () => {
  const info = parseNmcli(NMCLI_SAMPLE);
  assert.equal(info.ssid, "HomeNet");
  assert.equal(info.bssid, "aa:bb:cc:dd:ee:ff");
  assert.equal(info.channel, 6);
  assert.equal(info.band, "2.4GHz");
  assert.equal(info.rssi, -60);
});

test("parseNmcli returns empty fields when nothing is active", () => {
  const info = parseNmcli("no:OtherNet:11\\:22\\:33\\:44\\:55\\:66:6:2437 MHz:40\n");
  assert.equal(info.ssid, null);
  assert.equal(info.rssi, null);
});
