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
    } else if (action === 'get_event_list') {
      result = getEventList();
    } else if (action === 'save_event_card') {
      result = saveEventCardData(postData.extractedData, postData.photo1Base64, postData.photo2Base64, postData.eventInfo);
    } else if (action === 'get_event_data') {
      result = getEventSpecificData(postData.eventId, postData.eventName);
    } else if (action === 'save_visitor_and_get_contact') {
      result = saveVisitorAndGetContact(postData.visitorData);
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
  const SHEET_NAME = "Event Details";

  // --- Open Sheet ---
  let sheet;
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' not found.");
  } catch (e) {
    throw new Error("FAILED to access Spreadsheet: " + e.message);
  }

  const ALL_HEADERS = [
    "Timestamp", "Event ID", "Event Name", "Start Date", "End Date", "Location", "Description", 
    "Member Name", "Designation", "Phone",
    "Company Name", "Tagline", "Industry", "Founded Year", 
    "Official Phone", "Alternate Phone", "Official Email", "WhatsApp Number", 
    "Address Line 1", "City", "State", "Pincode", "Country", 
    "Website URL", "Google Maps Link", "LinkedIn profile link", "Instagram profile link", 
    "Facebook profile link", "Twitter profile link", "Services Provided", "About the company",
    "Key Person Name", "Key Person Designation", "Key Person Phone", "Key Person Email"
  ];
  
  // --- Auto-create or Patch header row ---
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ALL_HEADERS);
    sheet.getRange(1, 1, 1, ALL_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#d9e8fb")
      .setFontColor("#1a3a6b");
    sheet.setFrozenRows(1);
  } else {
    // Check if we need to patch old headers
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (currentHeaders.length < ALL_HEADERS.length) {
       // Write new headers over the first row to ensure they match
       sheet.getRange(1, 1, 1, ALL_HEADERS.length).setValues([ALL_HEADERS]);
    }
  }

  const timestamp = new Date();

  // --- Generate sequential Event ID ---
  let eventId = "EVT-001";
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const bCol = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      let lastIdValue = "";
      for (let i = bCol.length - 1; i >= 0; i--) {
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
    eventId = "EVT-" + Math.floor(1000 + Math.random() * 9000);
  }

  const members = eventData.teamMembers || [];
  
  // Extract Company Profile fields from eventData
  const cName = eventData.companyName || "";
  const cTagline = eventData.tagline || "";
  const cInd = eventData.industry || "";
  const cYear = eventData.foundedYear || "";
  const cOffPh = eventData.officialPhone || "";
  const cAltPh = eventData.alternatePhone || "";
  const cOffEm = eventData.officialEmail || "";
  const cWa = eventData.whatsappNumber || "";
  const cAddr = eventData.addressLine || "";
  const cCity = eventData.city || "";
  const cState = eventData.state || "";
  const cPin = eventData.pincode || "";
  const cCoun = eventData.country || "";
  const cWeb = eventData.websiteUrl || "";
  const cMaps = eventData.googleMapsLink || "";
  const cLi = eventData.linkedin || "";
  const cIg = eventData.instagram || "";
  const cFb = eventData.facebook || "";
  const cTw = eventData.twitter || "";
  const cServ = eventData.services || "";
  const cAbo = eventData.aboutCompany || "";
  const kpName = eventData.keyPersonName || "";
  const kpDesg = eventData.keyPersonDesignation || "";
  const kpPho = eventData.keyPersonPhone || "";
  const kpEma = eventData.keyPersonEmail || "";

  if (members.length === 0) {
    // No members — save one row with event & company details
    sheet.appendRow([
      timestamp, eventId, eventData.eventName || "", eventData.startDate || "", eventData.endDate || "", eventData.location || "", eventData.description || "",
      "", "", "",  // Member cols empty
      cName, cTagline, cInd, cYear, cOffPh, cAltPh, cOffEm, cWa, cAddr, cCity, cState, cPin, cCoun,
      cWeb, cMaps, cLi, cIg, cFb, cTw, cServ, cAbo, kpName, kpDesg, kpPho, kpEma
    ]);
  } else {
    members.forEach((m, index) => {
      if (index === 0) {
        // First row: Full event details + Member 1 + Company details
        sheet.appendRow([
          timestamp, eventId, eventData.eventName || "", eventData.startDate || "", eventData.endDate || "", eventData.location || "", eventData.description || "",
          m.name || "", m.designation || "", m.phone || "",
          cName, cTagline, cInd, cYear, cOffPh, cAltPh, cOffEm, cWa, cAddr, cCity, cState, cPin, cCoun,
          cWeb, cMaps, cLi, cIg, cFb, cTw, cServ, cAbo, kpName, kpDesg, kpPho, kpEma
        ]);
      } else {
        // Subsequent rows: Event ID only (to link back) + member info
        sheet.appendRow([
          "", eventId, "", "", "", "", "",
          m.name || "", m.designation || "", m.phone || ""
        ]);
      }
    });
  }

  return {
    success: true,
    message: "✅ Event '" + eventData.eventName + "' saved. ID: " + eventId,
    eventId: eventId
  };
}


function getEventList() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Event Details");
  if (!sheet) return { success: false, message: "Sheet 'Event Details' not found." };
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: [] };
  
  const events = [];
  for (let i = 1; i < data.length; i++) {
    // Column B is Event ID, Column C is Event Name, D: Start, E: End
    if (data[i][1] && data[i][2]) {
      events.push({
        id: data[i][1],
        name: data[i][2],
        startDate: data[i][3],
        endDate: data[i][4],
        location: data[i][5] || ""
      });
    }
  }
  return { success: true, data: events };
}

function saveEventCardData(extractedData, photo1Base64, photo2Base64, eventInfo) {
  const SHEET_NAME = "Event Ai Card";
  const FOLDER_ID = "1zggOUpg0SfMdi5LAXIfIWqZcBGMGHmMz";
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Timestamp", "Event ID", "Event Name", "Event Start Date", "Event End Date",
      "Card Photo 1", "Card Photo 2", "Company Name", "Industry", "Person Name",
      "Designation", "Phone", "Email", "Website", "Social Media", "Address",
      "Services", "Company Size", "Founded Year", "Registration Status",
      "Trust Score", "People (Founders)", "Is Validated", "Source Link",
      "About Company", "Location"
    ]);
    sheet.getRange(1, 1, 1, 26).setFontWeight("bold").setBackground("#f3f3f3");
  }

  let folder;
  try { folder = DriveApp.getFolderById(FOLDER_ID); } catch (e) { throw new Error("Drive Folder Error: " + e.message); }

  const timestamp = new Date();
  
  const saveImage = (base64, prefix) => {
    if (!base64 || base64.trim() === "") return "";
    try {
      const blob = Utilities.newBlob(Utilities.base64Decode(base64), "image/jpeg", prefix + "_" + timestamp.getTime() + ".jpg");
      const file = folder.createFile(blob);
      return file.getUrl();
    } catch (e) { return "Error: " + e.message; }
  };

  const img1 = saveImage(photo1Base64, "front");
  const img2 = saveImage(photo2Base64, "back");
  
  const d = extractedData || {};
  
  sheet.appendRow([
    timestamp,
    eventInfo.id || "N/A",
    eventInfo.name || "N/A",
    eventInfo.startDate || "N/A",
    eventInfo.endDate || "N/A",
    img1, img2,
    d.company_name || d.company || "",
    d.industry || "",
    d.person_name || d.name || "",
    d.designation || d.title || "",
    d.phone || "",
    d.email || "",
    d.website || "",
    d.social_media || "",
    d.address || "",
    d.services || "",
    d.company_size || "",
    d.founded_year || d.established_year || "",
    d.registration_status || "",
    d.trust_score || "",
    d.people || d.key_people || "",
    d.is_validated || "",
    d.source_link || d.validation_source || "",
    d.about_company || d.about_the_company || "",
    d.location || ""
  ]);

  return { success: true, message: "Card saved to Event Hub!" };
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
 * Fetch specific data for an event (Cards + Visitors)
 */
function getEventSpecificData(eventId, eventName) {
    if (!eventId && !eventName) return { success: false, message: "No Event identifier provided" };
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    const cardSheet = ss.getSheetByName("Event Ai Card");
    const visitorSheet = ss.getSheetByName("Visitor Details");
    
    const idStr = eventId ? String(eventId).trim().toLowerCase() : null;
    const nameStr = eventName ? String(eventName).trim().toLowerCase() : null;

    let cards = [];
    if (cardSheet) {
        const data = cardSheet.getDataRange().getValues();
        const headers = data[0];
        // Event ID: Col B (1), Event Name: Col C (2)
        for (let i = 1; i < data.length; i++) {
            const rowId = String(data[i][1]).trim().toLowerCase();
            const rowName = String(data[i][2]).trim().toLowerCase();
            
            if ((idStr && rowId === idStr) || (nameStr && rowName === nameStr)) {
                const obj = {};
                headers.forEach((h, idx) => obj[h] = data[i][idx]);
                cards.push(obj);
            }
        }
    }
    
    let visitors = [];
    if (visitorSheet) {
        const data = visitorSheet.getDataRange().getValues();
        const headers = data[0];
        // Event ID: Col B (1), Event Name: Col C (2)
        for (let i = 1; i < data.length; i++) {
            const rowId = String(data[i][1]).trim().toLowerCase();
            const rowName = String(data[i][2]).trim().toLowerCase();

            if ((idStr && rowId === idStr) || (nameStr && rowName === nameStr)) {
                const obj = {};
                headers.forEach((h, idx) => obj[h] = data[i][idx]);
                visitors.push(obj);
            }
        }
    }
    
    return { success: true, cards: cards, visitors: visitors };
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
      "Event ID",
      "Event Name",
      "Visitor Name", 
      "Visitor Mobile", 
      "Visitor Email", 
      "Visitor Organization", 
      "Visitor Designation", 
      "Message"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#f3f3f3");
  }
  
  const timestamp = new Date();
  sheet.appendRow([
    timestamp,
    leadData.eventId || "N/A",
    leadData.eventName || "N/A",
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
 * Save new Visitor from QR code form and return Event Contact Info for vCard 
 */
function saveVisitorAndGetContact(visitorData) {
  const SHEET_NAME = "Visitor Details";
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // 1. Fetch the Event Organizer contact info first to get Event Name
  const eventSheet = ss.getSheetByName("Event Details");
  let contactInfo = null;
  let eventName = "N/A";
  
  if (eventSheet) {
    const data = eventSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find the row where Column B matches eventId
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim().toLowerCase() === String(visitorData.eventId).trim().toLowerCase()) {
        const rowData = {};
        headers.forEach((h, idx) => {
          rowData[h] = data[i][idx];
        });
        
        eventName = rowData["Event Name"] || "N/A";
        let managerName = rowData["Member Name"] || rowData["Key Person Name"] || rowData["Event Name"];
        
        contactInfo = {
          name: managerName,
          company: rowData["Company Name"] || rowData["Event Name"],
          tagline: rowData["Tagline"] || "",
          industry: rowData["Industry"] || "",
          foundedYear: rowData["Founded Year"] || "",
          phone: rowData["Phone"] || rowData["Official Phone"] || "N/A",
          altPhone: rowData["Alternate Phone"] || "",
          email: rowData["Official Email"] || "N/A",
          whatsapp: rowData["WhatsApp Number"] || "",
          address: rowData["Address Line 1"] || rowData["Location"] || "",
          city: rowData["City"] || "",
          state: rowData["State"] || "",
          pincode: rowData["Pincode"] || "",
          country: rowData["Country"] || "",
          website: rowData["Website URL"] || "",
          mapsLink: rowData["Google Maps Link"] || "",
          linkedin: rowData["LinkedIn profile link"] || "",
          instagram: rowData["Instagram profile link"] || "",
          facebook: rowData["Facebook profile link"] || "",
          twitter: rowData["Twitter profile link"] || "",
          services: rowData["Services Provided"] || "",
          about: rowData["About the company"] || ""
        };
        break;
      }
    }
  }

  if (!contactInfo) {
    // If not found, return empty placeholder
    contactInfo = {
       name: "Event Organizer",
       company: visitorData.eventId,
       phone: "",
       email: "",
       website: ""
    };
  }

  // 2. Save the visitor details
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Timestamp", 
      "Event ID",
      "Event Name",
      "Visitor Name", 
      "Visitor Mobile", 
      "Visitor Email", 
      "Visitor Organization", 
      "Visitor Designation", 
      "Message"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#f3f3f3");
  }
  
  const timestamp = new Date();
  sheet.appendRow([
    timestamp,
    visitorData.eventId || "N/A",
    eventName,
    visitorData.visitorName || "",
    visitorData.visitorMobile || "",
    visitorData.visitorEmail || "",
    visitorData.visitorOrg || "",
    visitorData.visitorDesig || "",
    visitorData.message || ""
  ]);

  return { success: true, message: "Visitor saved successfully", contactInfo: contactInfo };
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
