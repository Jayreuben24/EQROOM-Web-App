#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <HardwareSerial.h>

const char *ssid = "HERNANDEZ FAMILY";
const char *password = "Aelh04072018.";

const char *scriptURL =
    "https://script.google.com/macros/s/AKfycbym2l38yG8nLia1QDgU7fhuyWT1deL85TugBv1BnPuFUvVb7kOUdI8NRICiToOg8eGl/exec";

const char *supabaseURL =
    "https://abvegwcbrdrddvnonmuo.supabase.co/rest/v1/transactions";

const char *supabaseKey =
    "sb_publishable_1Nz2tDVakyE5H9BPuBQIaw_eKNKg2Z5";

HardwareSerial GM67(2);

String studentID = "";
bool sessionOpen = false;

bool isStudentID(String code)
{

  code.trim();

  if (code.length() != 8)
  {
    return false;
  }

  if (!isdigit(code[0]) || !isdigit(code[1]))
  {
    return false;
  }

  if (code[2] != '-')
  {
    return false;
  }

  for (int i = 3; i < 8; i++)
  {

    if (!isdigit(code[i]))
    {
      return false;
    }
  }

  return true;
}

String urlEncode(String str)
{

  String encoded = "";

  for (int i = 0; i < str.length(); i++)
  {

    char c = str.charAt(i);

    if (isalnum(c) ||
        c == '-' ||
        c == '_' ||
        c == '.' ||
        c == '~')
    {

      encoded += c;
    }
    else
    {

      char hex[4];

      sprintf(
          hex,
          "%%%02X",
          (unsigned char)c);

      encoded += hex;
    }
  }

  return encoded;
}

bool checkStudent(String id)
{

  if (WiFi.status() != WL_CONNECTED)
  {

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
      HTTPC_STRICT_FOLLOW_REDIRECTS);

  int httpCode = http.GET();

  Serial.print("Google HTTP Response: ");
  Serial.println(httpCode);

  if (httpCode > 0)
  {

    String response = http.getString();

    response.trim();

    Serial.print("Google response: ");
    Serial.println(response);

    http.end();

    if (response == "STUDENT_ALLOWED")
    {

      return true;
    }

    if (response == "STUDENT_NOT_FOUND")
    {

      return false;
    }
  }

  http.end();

  return false;
}

bool sendItemToGoogleSheets(String itemQR)
{

  if (WiFi.status() != WL_CONNECTED)
  {

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
      HTTPC_STRICT_FOLLOW_REDIRECTS);

  int httpCode = http.GET();

  Serial.print("Google HTTP Response: ");
  Serial.println(httpCode);

  if (httpCode > 0)
  {

    String response = http.getString();

    response.trim();

    Serial.print("Google response: ");
    Serial.println(response);

    http.end();

    return true;
  }
  else
  {

    Serial.print("Google HTTP Error: ");
    Serial.println(
        http.errorToString(httpCode));
  }

  http.end();

  return false;
}

bool sendItemToSupabase(String itemQR)
{

  if (WiFi.status() != WL_CONNECTED)
  {

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
      "application/json");

  http.addHeader(
      "apikey",
      supabaseKey);

  http.addHeader(
      "Authorization",
      String("Bearer ") + supabaseKey);

  http.addHeader(
      "Prefer",
      "return=minimal");

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

  if (http.getSize() > 0)
  {

    String response = http.getString();

    response.trim();

    if (response.length() > 0)
    {

      Serial.print("Supabase response: ");
      Serial.println(response);
    }
  }

  http.end();

  if (httpCode >= 200 && httpCode < 300)
  {

    return true;
  }

  return false;
}

void setup()
{

  Serial.begin(115200);

  GM67.begin(
      9600,
      SERIAL_8N1,
      16,
      17);

  Serial.println();
  Serial.println("==============================");
  Serial.println("CONNECTING TO WIFI");
  Serial.println("==============================");

  WiFi.begin(
      ssid,
      password);

  while (WiFi.status() != WL_CONNECTED)
  {

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

void loop()
{

  if (!GM67.available())
  {

    return;
  }

  String qrCode = "";

  delay(50);

  while (GM67.available())
  {

    char c = GM67.read();

    if (c != '\r' && c != '\n')
    {

      qrCode += c;
    }

    delay(2);
  }

  qrCode.trim();

  if (qrCode.length() == 0)
  {

    return;
  }

  Serial.println();
  Serial.println("==============================");
  Serial.print("SCANNED: ");
  Serial.println(qrCode);
  Serial.println("==============================");

  if (!sessionOpen)
  {

    if (!isStudentID(qrCode))
    {

      Serial.println();
      Serial.println("==============================");
      Serial.println("INVALID STUDENT ID");
      Serial.println("==============================");

      Serial.println("PLEASE SCAN A STUDENT ID");
      Serial.println();

      return;
    }

    Serial.println();
    Serial.println("VERIFYING STUDENT...");

    if (checkStudent(qrCode))
    {

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
    }
    else
    {

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

  if (isStudentID(qrCode))
  {

    if (qrCode == studentID)
    {

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

    Serial.println();
    Serial.println("NEW STUDENT DETECTED");
    Serial.println("VERIFYING...");

    if (checkStudent(qrCode))
    {

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
    }
    else
    {

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

  Serial.println();
  Serial.println("==============================");
  Serial.println("ITEM QR DETECTED");
  Serial.println("==============================");

  Serial.print("Student ID: ");
  Serial.println(studentID);

  Serial.print("Item QR: ");
  Serial.println(qrCode);

  bool googleSuccess =
      sendItemToGoogleSheets(qrCode);

  bool supabaseSuccess =
      sendItemToSupabase(qrCode);

  Serial.println();
  Serial.println("==============================");
  Serial.println("ITEM PROCESSING COMPLETE");
  Serial.println("==============================");

  if (googleSuccess)
  {

    Serial.println("Google Sheets: RECORDED");
  }
  else
  {

    Serial.println("Google Sheets: FAILED");
  }

  if (supabaseSuccess)
  {

    Serial.println("Supabase: RECORDED");
  }
  else
  {

    Serial.println("Supabase: FAILED");
  }

  Serial.println();
  Serial.println("SCAN ANOTHER ITEM");
  Serial.println("OR SCAN STUDENT ID");
  Serial.println();
}
