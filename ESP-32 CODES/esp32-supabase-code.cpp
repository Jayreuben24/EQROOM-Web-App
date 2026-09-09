#include <WiFi.h>
#include <HTTPClient.h>

// GM67 on UART2 (adjust pins to your wiring)
HardwareSerial gm67(2);
#define GM67_RX 17  // ESP32 RX <- GM67 TX
#define GM67_TX 16  // ESP32 TX -> GM67 RX (often unused for read-only)

const char* supabaseUrl = "https://abvegwcbrdrddvnonmuo.supabase.co";
const char* supabaseKey = "sb_publishable_1Nz2tDVakyE5H9BPuBQIaw_eKNKg2Z5";
const char* deviceId = "CO-EQROOM QR SCANNER"; // unique identifier for this device

void setup() {
  Serial.begin(115200);
  gm67.begin(9600, SERIAL_8N1, GM67_RX, GM67_TX); // GM67 default baud is often 9600, check yours

  WiFi.begin("HERNANDEZ FAMILY", "Aelh04072018.");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void loop() {
  if (gm67.available()) {
    String scanValue = gm67.readStringUntil('\n');
    scanValue.trim();

    if (scanValue.length() > 0) {
      Serial.println("Scanned: " + scanValue);
      String scanType = detectScanType(scanValue);
      sendScan(scanType, scanValue, deviceId);
    }
  }
}

String detectScanType(String value) {
  // crude heuristic: QR payloads are often longer/URLs, barcodes are often pure numeric
  bool isNumeric = true;
  for (int i = 0; i < value.length(); i++) {
    if (!isDigit(value[i])) { isNumeric = false; break; }
  }
  return isNumeric ? "barcode" : "qr";
}

void sendScan(String scanType, String scanValue, String deviceId) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(supabaseUrl);
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseKey);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  String payload = "{\"scan_type\":\"" + scanType +
                    "\",\"scan_value\":\"" + scanValue +
                    "\",\"device_id\":\"" + deviceId + "\"}";

  int httpCode = http.POST(payload);
  Serial.printf("Scan POST -> %d\n", httpCode);
  if (httpCode > 0) {
    Serial.println(http.getString());
  }
  http.end();
}

String detectScanType(String value) {
  // crude heuristic: QR payloads are often longer/URLs, barcodes are often pure numeric
  bool isNumeric = true;
  for (int i = 0; i < value.length(); i++) {
    if (!isDigit(value[i])) { isNumeric = false; break; }
  }
  return isNumeric ? "barcode" : "qr";
}

void sendScan(String scanType, String scanValue, String deviceId) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(supabaseUrl);
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseKey);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  String payload = "{\"scan_type\":\"" + scanType +
                    "\",\"scan_value\":\"" + scanValue +
                    "\",\"device_id\":\"" + deviceId + "\"}";

  int httpCode = http.POST(payload);
  Serial.printf("Scan POST -> %d\n", httpCode);
  if (httpCode > 0) {
    Serial.println(http.getString());
  }
  http.end();
}