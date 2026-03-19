/**
 * ------------------------------------------------------------------
 * FINAL UPDATED APPS SCRIPT (FULL VERSION)
 * ------------------------------------------------------------------
 * This script handles:
 * 1. GET requests (doGet) - Returns all data for the Leads Dashboard.
 * 2. POST requests (doPost) - Handles 'extract', 'save', and 'read' actions.
 * ------------------------------------------------------------------
 */

/**
 * Handle GET requests to fetch whole sheet data for the Dashboard.
 */
function doGet(e) {
  try {
    // Default sheet for doGet if not specified, assuming "Ai Card" is the dashboard sheet
    const sheetData = getSheetData("Ai Card");
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: sheetData }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: "Script Error: " + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests for complex actions.
 */
const SHEET_ID = "1c3v7DcBqfMK8yzPyMs3StwNj7bg7yc5gSnEsHnmuBlg";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Invalid POST request received.");
    }

    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    let result;

    if (action === 'extract') {
      result = extractData(postData.photo1Base64);
    } else if (action === 'save') {
      result = saveData(postData.extractedData, postData.photo1Base64, postData.photo2Base64);
    } else if (action === 'save_event') {
      result = saveEventData(postData.eventData);
    } else if (action === 'save_lead') {
      result = saveLeadData(postData.leadData);
    } else if (action === 'read') {
      result = getSheetData(postData.sheetName);
    } else if (action === 'get_event') {
      result = getEventById(postData.eventId);
    } else {
      throw new Error("Invalid action specified: " + action);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: "Script Error: " + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function extractData(photo1Base64) {
  const PYTHON_BACKEND_URL = "https://ocr-reader-botivate.onrender.com";

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ base64Image: photo1Base64 }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(PYTHON_BACKEND_URL + "/ocr", options);
  if (response.getResponseCode() !== 200) {
    throw new Error("AI Server Error: " + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}

function saveData(extractedData, photo1Base64, photo2Base64) {
  // --- CONFIGURATION ---
  const SHEET_ID = "1c3v7DcBqfMK8yzPyMs3StwNj7bg7yc5gSnEsHnmuBlg";
  const FOLDER_ID = "1zggOUpg0SfMdi5LAXIfIWqZcBGMGHmMz";
  const SHEET_NAME = "Ai Card";
  // ---------------------

  let sheet;
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet with name '" + SHEET_NAME + "' not found.");
  } catch (e) {
    throw new Error("FAILED to access Spreadsheet. Check SHEET_ID or Sheet Name. Details: " + e.message);
  }

  let folder;
  try {
    folder = DriveApp.getFolderById(FOLDER_ID);
  } catch (e) {
    throw new Error("FAILED to access Drive Folder. Check FOLDER_ID. Details: " + e.message);
  }

  const timestamp = new Date();

  // Save Image 1
  let url1 = "";
  try {
    const blob1 = Utilities.newBlob(Utilities.base64Decode(photo1Base64), "image/png", "photo1_" + timestamp.getTime() + ".png");
    const file1 = folder.createFile(blob1);
    url1 = file1.getUrl();
  } catch (e) {
    throw new Error("Failed to save Image 1: " + e.message);
  }

  // Save Image 2
  let url2 = "";
  if (photo2Base64 && photo2Base64.trim() !== "") {
    try {
      const blob2 = Utilities.newBlob(Utilities.base64Decode(photo2Base64), "image/png", "photo2_" + timestamp.getTime() + ".png");
      const file2 = folder.createFile(blob2);
      url2 = file2.getUrl();
    } catch (e) {
      url2 = "Error saving image 2: " + e.message;
    }
  }

  // Hyperlink Logic
  let validationLink = extractedData.validation_source || "";
  const companyName = extractedData.company || "Source";

  if (extractedData.is_validated && extractedData.validation_source) {
    const safeUrl = extractedData.validation_source.replace(/"/g, '""');
    const safeName = companyName.replace(/"/g, '""');
    validationLink = `=HYPERLINK("${safeUrl}", "${safeName} Link")`;
  }

  // Format Key People (Founder/CEO + Contact)
  let keyPeopleString = "";
  if (extractedData.key_people && Array.isArray(extractedData.key_people)) {
    keyPeopleString = extractedData.key_people.map(p => {
      let details = p.name + " (" + p.role + ")";
      if (p.contact && p.contact !== "Not Found") {
        details += " - " + p.contact;
      }
      return details;
    }).join("\n");
  } else {
    let parts = [];
    if (extractedData.founder) parts.push("Founder: " + extractedData.founder);
    if (extractedData.ceo) parts.push("CEO: " + extractedData.ceo);
    if (extractedData.owner) parts.push("Owner: " + extractedData.owner);
    keyPeopleString = parts.join("\n");
  }

  // Append Row (Columns A-V)
  sheet.appendRow([
    timestamp,                          // A
    url1,                               // B
    url2,                               // C
    extractedData.company || "",        // D
    extractedData.industry || "",       // E 
    extractedData.name || "",           // F
    extractedData.title || "",          // G 
    extractedData.phone || "",          // H
    extractedData.email || "",          // I
    extractedData.website || "",        // J 
    extractedData.social_media || "",   // K 
    extractedData.address || "",        // L
    extractedData.services || "",       // M 
    extractedData.company_size || "",   // N 
    extractedData.established_year || extractedData.founded_year || "", // O 
    extractedData.registration_status || "", // P 
    extractedData.trust_score || "",    // Q
    keyPeopleString,                    // R 
    extractedData.is_validated,         // S
    validationLink,                     // T
    extractedData.about_the_company || "", // U
    extractedData.location || ""          // V
  ]);

  return { message: "✅ Data saved successfully!" };
}

function saveEventData(eventData) {
  const SHEET_ID = "1c3v7DcBqfMK8yzPyMs3StwNj7bg7yc5gSnEsHnmuBlg";
  const FOLDER_ID = "1zggOUpg0SfMdi5LAXIfIWqZcBGMGHmMz";
  const SHEET_NAME = "Event Details";

  let sheet;
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' not found.");
  } catch (e) {
    throw new Error("FAILED to access Spreadsheet: " + e.message);
  }

  let folder;
  try {
    folder = DriveApp.getFolderById(FOLDER_ID);
  } catch (e) {
    throw new Error("FAILED to access Drive Folder: " + e.message);
  }

  const timestamp = new Date();

  // --- Sequential Event ID ---
  let eventId = "EVT-001";
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      // Use getValues() once to avoid repeated sheet calls; scan B column backwards
      const bCol = sheet.getRange(1, 2, lastRow).getValues();
      let lastIdValue = "";
      for (let i = bCol.length - 1; i >= 1; i--) {
        if (bCol[i][0] && typeof bCol[i][0] === 'string' && bCol[i][0].startsWith("EVT-")) {
          lastIdValue = bCol[i][0];
          break;
        }
      }

      if (lastIdValue) {
        const lastNum = parseInt(lastIdValue.replace("EVT-", "").trim(), 10);
        if (!isNaN(lastNum)) {
          eventId = "EVT-" + (lastNum + 1).toString().padStart(3, "0");
        }
      }
    }
  } catch (e) {
    eventId = "EVT-" + Math.floor(1000 + Math.random() * 9000); // Fallback
  }

  // --- Save Logo ---
  let logoUrl = "";
  if (eventData.logoBase64 && eventData.logoBase64.trim() !== "") {
    try {
      const blob = Utilities.newBlob(Utilities.base64Decode(eventData.logoBase64), "image/png", "logo_" + eventId + "_" + timestamp.getTime() + ".png");
      const file = folder.createFile(blob);
      logoUrl = file.getUrl();
    } catch (e) {
      logoUrl = "Error saving logo: " + e.message;
    }
  }

  const members = eventData.teamMembers || [];
  
  // Columns A-AB: Event Info
  const baseData = [
    timestamp,                 // A: Timestamp
    eventId,                   // B: Event ID
    eventData.eventName,       // C: Event Name
    eventData.startDate,       // D: Start Date
    eventData.endDate,         // E: End Date
    eventData.location,        // F: Event Location
    eventData.description,     // G: Event Description
    eventData.companyName,     // H: Company Name
    eventData.tagline,         // I: Tagline
    eventData.industry,        // J: Industry
    eventData.foundedYear,     // K: Founded Year
    eventData.officialPhone,   // L: Official Phone
    eventData.alternatePhone,  // M: Alternate Phone
    eventData.officialEmail,   // N: Official Email
    eventData.whatsappNumber,  // O: WhatsApp Number
    eventData.addressLine,     // P: Address Line
    eventData.city,            // Q: City
    eventData.state,           // R: State
    eventData.pincode,         // S: Pincode
    eventData.country,         // T: Country
    eventData.websiteUrl,      // U: Website URL
    eventData.googleMapsLink,  // V: Google Maps Link
    eventData.linkedin,        // W: LinkedIn
    eventData.instagram,       // X: Instagram
    eventData.facebook,        // Y: Facebook
    eventData.twitter,         // Z: Twitter/X
    eventData.services,        // AA: Services Offered
    eventData.aboutCompany,    // AB: About Company
  ];

  // Columns AF-AJ (Approx): Branding & Settings
  const settingsData = [
    logoUrl,                   // AC: Company Logo URL
    eventData.themeColor,      // AD: Theme Color
    eventData.saveContact,     // AE: Setting: Save Contact
    eventData.downloadCard,    // AF: Setting: Download Card
    eventData.whatsappBtn      // AG: Setting: WhatsApp Button
  ];

  if (members.length === 0) {
    sheet.appendRow([...baseData, "N/A", "N/A", "N/A", ...settingsData]);
  } else {
    members.forEach((m, index) => {
      if (index === 0) {
        // First Row: Full Details
        sheet.appendRow([
          ...baseData, 
          m.name, m.designation, m.phone, 
          ...settingsData
        ]);
      } else {
        // Subsequent Rows: ONLY Member Info (Columns A to AB are empty)
        const emptyEvent = Array(28).fill(""); // A through AB
        sheet.appendRow([
          ...emptyEvent,
          m.name,       // AC: Member Name
          m.designation,// AD: Designation
          m.phone,      // AE: Member Phone
          "", "", "", "", "" // Empty settings
        ]);
      }
    });
  }

  return { message: "✅ Event '" + eventData.eventName + "' saved. ID: " + eventId, eventId: eventId };
}

function getEventById(eventId) {
    if (!eventId) return { success: false, message: "No Event ID provided" };
    
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Event Details");
    if (!sheet) return { success: false, message: "Sheet not found" };
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find the row where Column B matches eventId
    for (let i = 1; i < data.length; i++) {
        // Log for debugging (visible in Apps Script logs)
        // console.log("Checking row " + i + ": " + data[i][1]);
        if (String(data[i][1]).trim() == String(eventId).trim()) {
            const result = {};
            headers.forEach((h, idx) => {
                result[h] = data[i][idx];
            });
            return { success: true, data: result };
        }
    }
    
    return { success: false, message: "Event not found" };
}

/**
 * Save Lead Data from the QR Scan Form
 */
function saveLeadData(leadData) {
  const SHEET_NAME = "Visitor Details";
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Timestamp", 
      "Visitor Name", 
      "Visitor Mobile", 
      "Visitor Email", 
      "Visitor Organization", 
      "Visitor Designation", 
      "Message"
    ]);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f3f3f3");
  }
  
  const timestamp = new Date();
  sheet.appendRow([
    timestamp,
    leadData.fullName,
    leadData.mobile,
    leadData.email,
    leadData.organization,
    leadData.designation,
    leadData.message
  ]);
  
  return { success: true, message: "Lead saved successfully!" };
}

/**
 * Helper function to fetch all data from the sheet for Dashboard viewing.
 */
function getSheetData(SHEET_NAME) {
  if (!SHEET_NAME) SHEET_NAME = "Ai Card";
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet not found: " + SHEET_NAME);
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  const formulas = range.getFormulas();
  
  if (values.length < 2) return [];
  
  const headers = values[0];
  const data = [];
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowFormulas = formulas[i];
    const obj = {};
    headers.forEach((header, index) => {
      // Use formula if it exists (for hyperlinks), otherwise use value
      obj[header] = rowFormulas[index] || row[index];
    });
    data.push(obj);
  }
  
  return { success: true, data: data };
}
