#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Adafruit_Fingerprint.h>

const char *ssid = "HERNANDEZ FAMILY";
const char *password = "Aelh04072018.";

const char *scriptURL =
    "https://script.google.com/macros/s/AKfycbym2l38yG8nLia1QDgU7fhuyWT1deL85TugBv1BnPuFUvVb7kOUdI8NRICiToOg8eGl/exec";

const char *fingerprintFunctionURL =
    "https://abvegwcbrdrddvnonmuo.supabase.co/functions/v1/check-admin-fingerprint";

const char *supabaseKey =
    "sb_publishable_1Nz2tDVakyE5H9BPuBQIaw_eKNKg2Z5";

HardwareSerial fingerSerial(2);

#define FINGER_RX 16
#define FINGER_TX 17

Adafruit_Fingerprint finger =
    Adafruit_Fingerprint(&fingerSerial);

#define DOOR_RELAY_PIN 25

#define RELAY_UNLOCK HIGH
#define RELAY_LOCK LOW

const unsigned long DOOR_UNLOCK_TIME = 5000;

String urlEncode(String str)
{

  String encoded = "";

  for (int i = 0; i < str.length(); i++)
  {

    char c = str.charAt(i);

    if (
        isalnum(c) ||
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

String getJsonStringValue(
    String json,
    String key)
{

  String search =
      "\"" + key + "\":\"";

  int start =
      json.indexOf(search);

  if (start < 0)
  {
    return "";
  }

  start += search.length();

  int end =
      json.indexOf("\"", start);

  if (end < 0)
  {
    return "";
  }

  return json.substring(
      start,
      end);
}

bool sendDoorActivityToGoogle(
    String name,
    String profileId,
    int fingerprintID,
    String status)
{

  if (
      WiFi.status() != WL_CONNECTED)
  {

    Serial.println(
        "WiFi disconnected!");

    return false;
  }

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  String url =
      String(scriptURL) +

      "?type=doorActivity" +

      "&name=" +
      urlEncode(name) +

      "&profileId=" +
      urlEncode(profileId) +

      "&fingerprintId=" +
      String(fingerprintID) +

      "&action=door_access" +

      "&status=" +
      urlEncode(status);

  Serial.println();
  Serial.println(
      "Sending door activity to Google Sheets...");

  http.begin(
      client,
      url);

  http.setFollowRedirects(
      HTTPC_STRICT_FOLLOW_REDIRECTS);

  int httpCode =
      http.GET();

  Serial.print(
      "Google HTTP Response: ");

  Serial.println(
      httpCode);

  if (
      httpCode > 0)
  {

    String response =
        http.getString();

    response.trim();

    Serial.print(
        "Google response: ");

    Serial.println(
        response);

    http.end();

    if (
        httpCode >= 200 &&
        httpCode < 300)
    {

      return true;
    }

    return false;
  }

  Serial.print(
      "Google HTTP Error: ");

  Serial.println(
      http.errorToString(httpCode));

  http.end();

  return false;
}

bool checkFingerprintWithSupabase(
    int fingerprintID,
    String &ownerName,
    String &profileId)
{

  ownerName = "";
  profileId = "";

  if (
      WiFi.status() != WL_CONNECTED)
  {

    Serial.println(
        "WiFi disconnected. Access denied.");

    return false;
  }

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  Serial.println();
  Serial.println(
      "Checking fingerprint with Supabase...");

  if (
      !http.begin(
          client,
          fingerprintFunctionURL))
  {

    Serial.println(
        "Could not connect to Supabase.");

    return false;
  }

  http.addHeader(
      "Content-Type",
      "application/json");

  http.addHeader(
      "apikey",
      supabaseKey);

  http.addHeader(
      "Authorization",
      String("Bearer ") +
          supabaseKey);

  String jsonBody =
      "{\"fingerprint_id\":" +
      String(fingerprintID) +
      "}";

  Serial.print(
      "Supabase JSON: ");

  Serial.println(
      jsonBody);

  int httpCode =
      http.POST(
          jsonBody);

  Serial.print(
      "Supabase HTTP Response: ");

  Serial.println(
      httpCode);

  String response =
      http.getString();

  response.trim();

  Serial.print(
      "Supabase response: ");

  Serial.println(
      response);

  ownerName =
      getJsonStringValue(
          response,
          "name");

  profileId =
      getJsonStringValue(
          response,
          "profile_id");

  http.end();

  if (
      httpCode < 200 ||
      httpCode >= 300)
  {

    return false;
  }

  if (
      response.indexOf(
          "\"access\":true") >= 0)
  {

    return true;
  }

  return false;
}

int getFingerprintID()
{

  uint8_t p;

  p =
      finger.getImage();

  if (
      p == FINGERPRINT_NOFINGER)
  {

    return -1;
  }

  if (
      p != FINGERPRINT_OK)
  {

    Serial.println(
        "Error capturing fingerprint.");

    return -1;
  }

  Serial.println(
      "Fingerprint detected.");

  p =
      finger.image2Tz();

  if (
      p != FINGERPRINT_OK)
  {

    Serial.println(
        "Could not process fingerprint.");

    return -1;
  }

  p =
      finger.fingerSearch();

  if (
      p == FINGERPRINT_OK)
  {

    return finger.fingerID;
  }

  if (
      p == FINGERPRINT_NOTFOUND)
  {

    Serial.println();
    Serial.println(
        "UNKNOWN FINGERPRINT");

    Serial.println(
        "ACCESS DENIED");

    while (
        finger.getImage() !=
        FINGERPRINT_NOFINGER)
    {

      delay(100);
    }

    delay(700);

    Serial.println();
    Serial.println(
        "Place finger on sensor...");

    return -1;
  }

  Serial.println(
      "Fingerprint search error.");

  return -1;
}

void unlockDoor()
{

  Serial.println(
      "Door unlock authorized.");

  digitalWrite(
      DOOR_RELAY_PIN,
      RELAY_UNLOCK);

  Serial.println(
      "Door unlocked for 5 seconds.");

  delay(
      DOOR_UNLOCK_TIME);

  digitalWrite(
      DOOR_RELAY_PIN,
      RELAY_LOCK);

  Serial.println(
      "Door locked.");
}

void setup()
{

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println(
      "======================================");

  Serial.println(
      "ADMIN FINGERPRINT ACCESS SYSTEM");

  Serial.println(
      "======================================");

  pinMode(
      DOOR_RELAY_PIN,
      OUTPUT);

  digitalWrite(
      DOOR_RELAY_PIN,
      RELAY_LOCK);

  fingerSerial.begin(
      57600,
      SERIAL_8N1,
      FINGER_RX,
      FINGER_TX);

  finger.begin(
      57600);

  if (
      finger.verifyPassword())
  {

    Serial.println(
        "Fingerprint sensor connected!");
  }
  else
  {

    Serial.println(
        "Fingerprint sensor NOT detected.");

    while (true)
    {

      digitalWrite(
          DOOR_RELAY_PIN,
          RELAY_LOCK);

      delay(1000);
    }
  }

  finger.getTemplateCount();

  Serial.print(
      "Stored fingerprints: ");

  Serial.println(
      finger.templateCount);

  Serial.println();
  Serial.print(
      "Connecting to WiFi");

  WiFi.begin(
      ssid,
      password);

  while (
      WiFi.status() !=
      WL_CONNECTED)
  {

    delay(500);

    Serial.print(".");
  }

  Serial.println();

  Serial.println(
      "WiFi connected!");

  Serial.print(
      "ESP32 IP: ");

  Serial.println(
      WiFi.localIP());

  Serial.println();
  Serial.println(
      "======================================");

  Serial.println(
      "SYSTEM READY");

  Serial.println(
      "======================================");

  Serial.println(
      "R307S: CONNECTED");

  Serial.println(
      "Supabase: ENABLED");

  Serial.println(
      "Google Apps Script: ENABLED");

  Serial.println();
  Serial.println(
      "Place finger on sensor...");
}

void loop()
{

  int fingerprintID =
      getFingerprintID();

  if (
      fingerprintID <= 0)
  {

    delay(100);

    return;
  }

  Serial.println();
  Serial.println(
      "======================================");

  Serial.print(
      "Fingerprint ID detected: ");

  Serial.println(
      fingerprintID);

  Serial.print(
      "Confidence: ");

  Serial.println(
      finger.confidence);

  String ownerName = "";

  String profileId = "";

  bool accessGranted =
      checkFingerprintWithSupabase(
          fingerprintID,
          ownerName,
          profileId);

  if (
      accessGranted)
  {

    Serial.println();
    Serial.println(
        "ACCESS GRANTED");

    Serial.print(
        "Admin: ");

    Serial.println(
        ownerName);

    bool googleSuccess =
        sendDoorActivityToGoogle(
            ownerName,
            profileId,
            fingerprintID,
            "granted");

    if (
        googleSuccess)
    {

      Serial.println(
          "Google Sheets: RECORDED");
    }
    else
    {

      Serial.println(
          "Google Sheets: FAILED");
    }

    unlockDoor();
  }

  else
  {

    Serial.println();
    Serial.println(
        "ACCESS DENIED");

    if (
        ownerName.length() == 0)
    {

      ownerName = "Unknown";
    }

    bool googleSuccess =
        sendDoorActivityToGoogle(
            ownerName,
            profileId,
            fingerprintID,
            "denied");

    if (
        googleSuccess)
    {

      Serial.println(
          "Google Sheets: RECORDED");
    }
    else
    {

      Serial.println(
          "Google Sheets: FAILED");
    }

    digitalWrite(
        DOOR_RELAY_PIN,
        RELAY_LOCK);
  }

  Serial.println(
      "======================================");

  Serial.println(
      "Remove finger...");

  while (
      finger.getImage() !=
      FINGERPRINT_NOFINGER)
  {

    delay(100);
  }

  delay(1000);

  Serial.println();
  Serial.println(
      "Place finger on sensor...");
}
