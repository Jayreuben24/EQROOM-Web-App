/*
  CO-EQROOM — ESP32 + GM67 Scanner (Session-Based) -> Google Sheets + Supabase
  -----------------------------------------------------------------------------
  This is your team's original session-based firmware (student ID opens a
  session, then any number of item scans are logged against it, scanning the
  same student ID again closes the session) with ONE change: the Supabase
  call now targets OUR project directly via a plain REST insert into
  `public.transactions`, instead of the other team's project + Edge Function.

  What changed vs. your original code:
    - supabaseURL now points to OUR project's REST endpoint:
        https://abvegwcbrdrddvnonmuo.supabase.co/rest/v1/transactions
      (your original code POSTed to a different project's Edge Function:
        https://dsrnkxfcweqpgposjcrl.supabase.co/functions/v1/scan-item)
    - supabaseKey is now OUR project's publishable/anon key.
    - Added a "Prefer: return=minimal" header (standard for PostgREST
      inserts — keeps the response small since we don't need the row back).
    - Added a "Content-Length"-safe response read guard so we don't call
      http.getString() when there's no body (return=minimal can send one
      back empty on success).

  What stayed EXACTLY the same:
    - isStudentID() / urlEncode() helpers
    - checkStudent() — still verifies the student against your Google Apps
      Script / Google Sheets roster before opening a session
    - sendItemToGoogleSheets() — Google Sheets dual-logging is UNCHANGED,
      every item scan still gets logged there too
    - The full session state machine in loop(): scan ID to open a session,
      scan items any number of times, scan the SAME ID again to close it,
      scan a DIFFERENT ID to switch sessions
    - WiFi credentials, GM67 wiring/pins, all Serial Monitor messages

  Why no "action" field (borrow/return) in the JSON we send:
    OUR Supabase project has a database trigger (process_scan_transaction,
    in "QUERY 4" of your SQL doc) that looks up the item's current status
    and figures out borrow-vs-return on its own, then flips the item's
    status — so the ESP32 only ever needs to send {student_id, item_qr}.
    If a scanned item_qr doesn't exist in the `items` table, or the
    student_id isn't in `students`, Supabase will reject the insert with a
    descriptive error, which gets printed to the Serial Monitor below.

  Required libraries: none beyond the ESP32 Arduino core
  (WiFi.h, HTTPClient.h, WiFiClientSecure.h all ship with it).
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <HardwareSerial.h>

// ============================================================
// WIFI — same as your original code
// ============================================================
const char* ssid = "HERNANDEZ FAMILY";
const char* password = "Aelh04072018.";

// ============================================================
// GOOGLE APPS SCRIPT — unchanged, still used for student
// verification (checkStudent) and Google Sheets dual-logging
// ============================================================
const char* scriptURL =
  "https://script.google.com/macros/s/AKfycbym2l38yG8nLia1QDgU7fhuyWT1deL85TugBv1BnPuFUvVb7kOUdI8NRICiToOg8eGl/exec";

// ============================================================
// SUPABASE — CHANGED to point at OUR project, direct REST insert
// ============================================================
const char* supabaseURL =
  "https://abvegwcbrdrddvnonmuo.supabase.co/rest/v1/transactions";

const char* supabaseKey =
  "sb_publishable_1Nz2tDVakyE5H9BPuBQIaw_eKNKg2Z5";

HardwareSerial GM67(2);

String studentID = "";
bool sessionOpen = false;


// ==========================================
// CHECK STUDENT ID FORMAT
// Example: 23-00046
// ==========================================

bool isStudentID(String code) {

  code.trim();

  if (code.length() != 8) {
    return false;
  }

  if (!isdigit(code[0]) || !isdigit(code[1])) {
    return false;
  }

  if (code[2] != '-') {
    return false;
  }

  for (int i = 3; i < 8; i++) {

    if (!isdigit(code[i])) {
      return false;
    }
  }

  return true;
}


// ==========================================
// URL ENCODE
// ==========================================

String urlEncode(String str) {

  String encoded = "";

  for (int i = 0; i < str.length(); i++) {

    char c = str.charAt(i);

    if (isalnum(c) ||
        c == '-' ||
        c == '_' ||
        c == '.' ||
        c == '~') {

      encoded += c;

    } else {

      char hex[4];

      sprintf(
        hex,
        "%%%02X",
        (unsigned char)c
      );

      encoded += hex;
    }
  }

  return encoded;
}


// ==========================================
// CHECK IF STUDENT IS REGISTERED
// GOOGLE APPS SCRIPT — unchanged
// ==========================================

bool checkStudent(String id) {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("WiFi disconnected!");

    return false;
  }

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  String url =
    String(scriptURL) +
    "?action=checkStudent&studentId=" +
    urlEncode(id);

  Serial.println();
  Serial.println("Checking student registration...");

  http.begin(client, url);

  http.setFollowRedirects(
    HTTPC_STRICT_FOLLOW_REDIRECTS
  );

  int httpCode = http.GET();

  Serial.print("Google HTTP Response: ");
  Serial.println(httpCode);

  if (httpCode > 0) {

    String response = http.getString();

    response.trim();

    Serial.print("Google response: ");
    Serial.println(response);

    http.end();

    if (response == "STUDENT_ALLOWED") {

      return true;
    }

    if (response == "STUDENT_NOT_FOUND") {

      return false;
    }
  }

  http.end();

  return false;
}


// ==========================================
// SEND ITEM TO GOOGLE SHEETS — unchanged,
// dual-logging is kept exactly as you had it
// ==========================================

bool sendItemToGoogleSheets(String itemQR) {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("WiFi disconnected!");

    return false;
  }

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  String url =
    String(scriptURL) +
    "?studentId=" +
    urlEncode(studentID) +
    "&itemQr=" +
    urlEncode(itemQR);

  Serial.println();
  Serial.println("Sending item to Google Sheets...");

  http.begin(client, url);

  http.setFollowRedirects(
    HTTPC_STRICT_FOLLOW_REDIRECTS
  );

  int httpCode = http.GET();

  Serial.print("Google HTTP Response: ");
  Serial.println(httpCode);

  if (httpCode > 0) {

    String response = http.getString();

    response.trim();

    Serial.print("Google response: ");
    Serial.println(response);

    http.end();

    return true;

  } else {

    Serial.print("Google HTTP Error: ");
    Serial.println(
      http.errorToString(httpCode)
    );
  }

  http.end();

  return false;
}


// ==========================================
// SEND ITEM TO SUPABASE
// CHANGED: now a direct REST insert into
// OUR project's public.transactions table
// ==========================================

bool sendItemToSupabase(String itemQR) {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("WiFi disconnected!");

    return false;
  }

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  Serial.println();
  Serial.println("Sending item to Supabase...");

  http.begin(client, supabaseURL);

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "apikey",
    supabaseKey
  );

  http.addHeader(
    "Authorization",
    String("Bearer ") + supabaseKey
  );

  // Tells PostgREST we don't need the inserted row echoed back —
  // keeps the response small/empty on success.
  http.addHeader(
    "Prefer",
    "return=minimal"
  );

  String json =
    "{\"student_id\":\"" +
    studentID +
    "\",\"item_qr\":\"" +
    itemQR +
    "\"}";

  Serial.print("Supabase JSON: ");
  Serial.println(json);

  int httpCode = http.POST(json);

  Serial.print("Supabase HTTP Response: ");
  Serial.println(httpCode);

  // With return=minimal, a successful insert can come back with an
  // empty body — only print it if there's actually something there.
  if (http.getSize() > 0) {

    String response = http.getString();

    response.trim();

    if (response.length() > 0) {

      Serial.print("Supabase response: ");
      Serial.println(response);
    }
  }

  http.end();

  if (httpCode >= 200 && httpCode < 300) {

    return true;
  }

  return false;
}


// ==========================================
// SETUP
// ==========================================

void setup() {

  Serial.begin(115200);


  // ========================================
  // GM67 UART
  //
  // GM67 TX → ESP32 GPIO16 RX
  // GM67 RX → ESP32 GPIO17 TX
  // GM67 GND → ESP32 GND
  // GM67 5V → ESP32 5V/VIN
  // ========================================

  GM67.begin(
    9600,
    SERIAL_8N1,
    16,
    17
  );


  Serial.println();
  Serial.println("==============================");
  Serial.println("CONNECTING TO WIFI");
  Serial.println("==============================");

  WiFi.begin(
    ssid,
    password
  );


  while (WiFi.status() != WL_CONNECTED) {

    delay(500);

    Serial.print(".");
  }


  Serial.println();

  Serial.println("WiFi connected!");

  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());


  Serial.println();
  Serial.println("==============================");
  Serial.println("SYSTEM READY");
  Serial.println("==============================");

  Serial.println("GM67: CONNECTED");
  Serial.println("Google Apps Script: ENABLED");
  Serial.println("Supabase: ENABLED (abvegwcbrdrddvnonmuo)");

  Serial.println();
  Serial.println("SCAN STUDENT ID");
  Serial.println();
}


// ==========================================
// MAIN LOOP — session logic unchanged
// ==========================================

void loop() {

  if (!GM67.available()) {

    return;
  }


  String qrCode = "";

  delay(50);


  while (GM67.available()) {

    char c = GM67.read();

    if (c != '\r' && c != '\n') {

      qrCode += c;
    }

    delay(2);
  }


  qrCode.trim();


  if (qrCode.length() == 0) {

    return;
  }


  Serial.println();
  Serial.println("==============================");
  Serial.print("SCANNED: ");
  Serial.println(qrCode);
  Serial.println("==============================");


  // ==========================================
  // NO ACTIVE SESSION
  // ==========================================

  if (!sessionOpen) {


    // Must be a student ID

    if (!isStudentID(qrCode)) {

      Serial.println();
      Serial.println("==============================");
      Serial.println("INVALID STUDENT ID");
      Serial.println("==============================");

      Serial.println("PLEASE SCAN A STUDENT ID");
      Serial.println();

      return;
    }


    // ========================================
    // CHECK STUDENT IN GOOGLE SHEETS
    // ========================================

    Serial.println();
    Serial.println("VERIFYING STUDENT...");


    if (checkStudent(qrCode)) {

      studentID = qrCode;

      sessionOpen = true;


      Serial.println();
      Serial.println("==============================");
      Serial.println("STUDENT APPROVED");
      Serial.println("==============================");

      Serial.print("Student ID: ");
      Serial.println(studentID);

      Serial.println();
      Serial.println("SCAN ITEM QR");
      Serial.println("SCAN MORE ITEMS AS NEEDED");
      Serial.println("SCAN STUDENT ID AGAIN TO CLOSE");
      Serial.println();

    } else {

      Serial.println();
      Serial.println("==============================");
      Serial.println("ACCESS DENIED");
      Serial.println("==============================");

      Serial.print("Student ID ");
      Serial.print(qrCode);
      Serial.println(" is not registered.");

      Serial.println();
      Serial.println("PLEASE SCAN A REGISTERED STUDENT");
      Serial.println();

    }

    return;
  }


  // ==========================================
  // ACTIVE SESSION
  // ==========================================

  if (isStudentID(qrCode)) {


    // ========================================
    // SAME STUDENT = CLOSE SESSION
    // ========================================

    if (qrCode == studentID) {

      Serial.println();
      Serial.println("==============================");
      Serial.println("SESSION CLOSED");
      Serial.println("==============================");

      Serial.print("Student ID: ");
      Serial.println(studentID);

      studentID = "";

      sessionOpen = false;


      Serial.println();
      Serial.println("READY FOR NEXT STUDENT");
      Serial.println();

      return;
    }


    // ========================================
    // DIFFERENT STUDENT
    // ========================================

    Serial.println();
    Serial.println("NEW STUDENT DETECTED");
    Serial.println("VERIFYING...");


    if (checkStudent(qrCode)) {

      Serial.println();
      Serial.println("==============================");
      Serial.println("SWITCHING STUDENT");
      Serial.println("==============================");

      Serial.print("Previous: ");
      Serial.println(studentID);

      Serial.print("New: ");
      Serial.println(qrCode);


      studentID = qrCode;


      Serial.println();
      Serial.println("NEW STUDENT SESSION OPEN");
      Serial.println("SCAN ITEM QR");
      Serial.println();

    } else {

      Serial.println();
      Serial.println("==============================");
      Serial.println("ACCESS DENIED");
      Serial.println("==============================");

      Serial.print("Student ID ");
      Serial.print(qrCode);
      Serial.println(" is not registered.");

      Serial.println();
      Serial.print("CURRENT SESSION REMAINS: ");
      Serial.println(studentID);

      Serial.println();

    }

    return;
  }


  // ==========================================
  // ITEM QR
  // ==========================================

  Serial.println();
  Serial.println("==============================");
  Serial.println("ITEM QR DETECTED");
  Serial.println("==============================");

  Serial.print("Student ID: ");
  Serial.println(studentID);

  Serial.print("Item QR: ");
  Serial.println(qrCode);


  // ==========================================
  // SEND TO BOTH SYSTEMS
  // ==========================================

  bool googleSuccess =
    sendItemToGoogleSheets(qrCode);

  bool supabaseSuccess =
    sendItemToSupabase(qrCode);


  // ==========================================
  // RESULT
  // ==========================================

  Serial.println();
  Serial.println("==============================");
  Serial.println("ITEM PROCESSING COMPLETE");
  Serial.println("==============================");


  if (googleSuccess) {

    Serial.println("Google Sheets: RECORDED");

  } else {

    Serial.println("Google Sheets: FAILED");
  }


  if (supabaseSuccess) {

    Serial.println("Supabase: RECORDED");

  } else {

    Serial.println("Supabase: FAILED");
  }


  Serial.println();
  Serial.println("SCAN ANOTHER ITEM");
  Serial.println("OR SCAN STUDENT ID");
  Serial.println();
}
