/*
  CO-EQROOM — ESP32 + GM67 Barcode/QR Scanner -> Supabase
  ---------------------------------------------------------
  Workflow: scan a student ID barcode, then scan an item's QR/barcode.
  The ESP32 pairs the two scans into one transaction and POSTs them to
  Supabase. It does NOT decide borrow vs. return -- the database
  trigger `process_scan_transaction` (see "QUERY 4" in your SQL doc)
  looks at the item's current status and derives that automatically,
  then flips the item's status too. This device only ever needs to
  send (student_id, item_qr).

  Wiring (adjust to match your actual board/module):
    GM67 TX  -> ESP32 GPIO16 (RX2)
    GM67 RX  -> ESP32 GPIO17 (TX2)   [only needed if you send config commands]
    GM67 VCC -> 5V (check your module's voltage requirement)
    GM67 GND -> GND
  Confirm the GM67 is set to UART/serial output mode (not USB-HID/
  keyboard-wedge mode) and note its configured baud rate -- 9600 is
  the common default, set GM67_BAUD below to match.

  Required library: none beyond the ESP32 Arduino core
  (WiFi.h, HTTPClient.h, WiFiClientSecure.h all ship with it).
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ============================================================
// CONFIG -- fill these in for your network and Supabase project
// ============================================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* SUPABASE_URL      = "https://abvegwcbrdrddvnonmuo.supabase.co";
const char* SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";
// ============================================================

#define GM67_RX_PIN 16   // ESP32 RX2  <- GM67 TX
#define GM67_TX_PIN 17   // ESP32 TX2  -> GM67 RX
#define GM67_BAUD   9600

HardwareSerial GM67(2); // ESP32 hardware UART2

enum ScanState { WAITING_FOR_STUDENT, WAITING_FOR_ITEM };
ScanState state = WAITING_FOR_STUDENT;

String pendingStudentId = "";
unsigned long studentScanTime = 0;
const unsigned long ITEM_SCAN_TIMEOUT_MS = 15000; // reset if no item scan follows within 15s

void setup() {
  Serial.begin(115200);
  GM67.begin(GM67_BAUD, SERIAL_8N1, GM67_RX_PIN, GM67_TX_PIN);

  connectWiFi();

  Serial.println();
  Serial.println("Ready. Scan a student ID card.");
}

void loop() {
  // If a student card was scanned but no item followed in time, reset.
  if (state == WAITING_FOR_ITEM && millis() - studentScanTime > ITEM_SCAN_TIMEOUT_MS) {
    Serial.println("Timed out waiting for the item scan. Scan a student ID card again.");
    state = WAITING_FOR_STUDENT;
    pendingStudentId = "";
  }

  if (GM67.available()) {
    String code = readScanLine();
    if (code.length() == 0) return;

    if (state == WAITING_FOR_STUDENT) {
      pendingStudentId = code;
      studentScanTime = millis();
      state = WAITING_FOR_ITEM;
      Serial.print("Student scanned: ");
      Serial.println(pendingStudentId);
      Serial.println("Now scan the item.");
    } else {
      String itemQr = code;
      Serial.print("Item scanned: ");
      Serial.println(itemQr);
      logTransaction(pendingStudentId, itemQr);

      // Reset for the next student either way -- check Supabase logs
      // (or the serial monitor output below) for anything that failed.
      state = WAITING_FOR_STUDENT;
      pendingStudentId = "";
      Serial.println("---");
      Serial.println("Ready. Scan a student ID card.");
    }
  }
}

String readScanLine() {
  String line = GM67.readStringUntil('\n');
  line.trim(); // drop the trailing \r and any stray whitespace
  return line;
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected. IP: ");
  Serial.println(WiFi.localIP());
}

void logTransaction(const String& studentId, const String& itemQr) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi dropped -- reconnecting before logging.");
    connectWiFi();
  }

  WiFiClientSecure client;
  client.setInsecure(); // Prototype-friendly: skips TLS certificate
                         // validation. For production, pin Supabase's
                         // CA certificate instead of using setInsecure().

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/transactions";

  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  // "action" is intentionally omitted -- the process_scan_transaction
  // trigger in Supabase derives borrow/return on its own. This simple
  // concatenation assumes scanned codes never contain a literal " or \
  // (true for normal barcode/QR IDs); swap in ArduinoJson if that's
  // ever a concern for your ID format.
  String payload = String("{\"student_id\":\"") + studentId +
                    "\",\"item_qr\":\"" + itemQr + "\"}";

  int statusCode = http.POST(payload);

  if (statusCode == 201) {
    Serial.println("Transaction logged successfully.");
  } else {
    Serial.print("Failed to log transaction. HTTP ");
    Serial.println(statusCode);
    Serial.println(http.getString()); // Supabase's error message, e.g.
                                        // "Unknown item QR/barcode: ..."
                                        // or "Unknown student ID: ..."
  }

  http.end();
}
