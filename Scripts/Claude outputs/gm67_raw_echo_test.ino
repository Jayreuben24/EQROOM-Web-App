/*
  GM67 RAW ECHO TEST — isolates the scanner from WiFi/Supabase entirely.

  This does nothing but print every raw byte the GM67 sends over UART2
  straight to the Serial Monitor. No WiFi, no HTTP, no session logic —
  if this doesn't print anything when you scan a code, the problem is
  100% in the scanner/wiring/config, not in the CO-EQROOM firmware.

  Wiring (same as your working setup):
    GM67 TX  -> ESP32 GPIO16 (RX2)
    GM67 RX  -> ESP32 GPIO17 (TX2)   [not required for scanning, only if
                                       you send config commands to it]
    GM67 GND -> ESP32 GND
    GM67 VCC -> 5V (check your module's label — most GM67 modules want 5V,
                     not 3.3V, and want it from a supply that can handle
                     the current spike when the laser/beeper fires, not
                     just the ESP32's onboard 3.3V regulator's 5V passthrough)

  How to use:
    1. Upload this sketch.
    2. Open Serial Monitor at 115200 baud.
    3. Point the GM67 at any barcode/QR code and let it scan (it should
       beep/flash like it did before).
    4. Watch what appears below.
*/

#include <HardwareSerial.h>

HardwareSerial GM67(2);

void setup() {
  Serial.begin(115200);
  GM67.begin(9600, SERIAL_8N1, 16, 17);

  Serial.println();
  Serial.println("==============================");
  Serial.println("GM67 RAW ECHO TEST");
  Serial.println("==============================");
  Serial.println("Scan any barcode/QR code now.");
  Serial.println();
}

void loop() {
  if (GM67.available()) {
    Serial.print("[RAW] ");
    while (GM67.available()) {
      int b = GM67.read();
      // Print both the character (if printable) and its hex byte value,
      // so we can see hidden/control characters too (e.g. wrong baud
      // rate often shows up as garbage bytes here, not clean text).
      if (b >= 32 && b <= 126) {
        Serial.write((char)b);
      } else {
        Serial.print("[0x");
        if (b < 16) Serial.print("0");
        Serial.print(b, HEX);
        Serial.print("]");
      }
    }
    Serial.println();
  }
}
