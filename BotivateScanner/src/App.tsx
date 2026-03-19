import { QRCodeSVG } from "qrcode.react"
import { useState, useEffect } from "react"
import { Phone, Mail, MapPin, Globe, Download, QrCode } from "lucide-react"
import jsPDF from "jspdf"
// @ts-ignore - QRCode library doesn't have TypeScript definitions
import QRCodeLib from "qrcode"

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzCPeTYr3DyfmQaEJCQ_A7KnKJ9gZtz4zO-chHkLyvxMFsCd2JRWikUB8LxpFwwbuczxw/exec";

interface ContactInfo {
  firstName: string
  lastName: string
  title: string
  organization: string
  phone: string
  email: string
  address: string
  website: string
  logo: string
}

function App() {
  const [screenSize, setScreenSize] = useState({ width: 1024 })
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setScreenSize({ width: window.innerWidth })

    const handleResize = () => {
      setScreenSize({ width: window.innerWidth })
    }

    window.addEventListener('resize', handleResize)

    // Fetch dynamic data if ID is present
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('id');

    if (eventId) {
      fetchEventData(eventId);
    } else {
      // Default fallback if no ID
      setContactInfo({
        firstName: "Satyendra",
        lastName: "Tandan",
        title: "Founder & CEO",
        organization: "Botivate Services LLP",
        phone: "8871527519",
        email: "satyendra@botivate.in",
        address: "Office No - 224, Shriram Business Park, Amaseoni, Vidhan Sabha Rd, Raipur, Chhattisgarh 493111",
        website: "www.botivate.in",
        logo: "images/Botivate.png",
      });
      setLoading(false);
    }

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const convertDriveLink = (url: string) => {
    if (!url) return url;
    let cleanUrl = String(url).trim();
    
    // Extract URL from =HYPERLINK("url", "label")
    if (cleanUrl.startsWith('=HYPERLINK')) {
      const match = cleanUrl.match(/"(.*?)"/);
      if (match) cleanUrl = match[1];
    }
    
    if (cleanUrl.includes('drive.google.com')) {
      // Robust Drive ID match
      const match = cleanUrl.match(/\/d\/(.+?)(\/|\?|$)/) || cleanUrl.match(/id=(.+?)(&|$)/);
      if (match && match[1]) {
        // Use direct link
        return `https://drive.google.com/uc?id=${match[1]}`;
      }
    }
    return cleanUrl;
  };

  const wrapWithProxy = (url: string) => {
    if (!url || url.includes('localhost') || url.startsWith('images/') || !url.startsWith('http')) {
      return url;
    }
    return `/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const fetchEventData = async (id: string) => {
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_event', eventId: id }),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
      const res = await response.json();
      console.log("Fetch result:", res);
      
      // The Apps Script now returns { success: true, data: { ... } }
      if (res.success && res.data) {
        const d = res.data;
        
        // Find logo key case-insensitively
        const allKeys = Object.keys(d);
        const logoKey = allKeys.find(k => {
          const lk = k.toLowerCase();
          return lk.includes('logo') || lk.includes('photo') || lk.includes('image');
        });
        const rawLogo = logoKey ? d[logoKey] : "images/Botivate.png";
        
        console.log("Raw logo:", rawLogo);
        const processedLogo = convertDriveLink(rawLogo);
        const finalLogo = wrapWithProxy(processedLogo);
        console.log("Final logo (proxied):", finalLogo);

        setContactInfo({
          firstName: d["Member Name"] ? d["Member Name"].split(' ')[0] : (d["Event Name"] || "Event"),
          lastName: d["Member Name"] ? d["Member Name"].split(' ').slice(1).join(' ') : "",
          title: d["Designation"] || "Event Organizer",
          organization: d["Company Name"] || "Botivate Services LLP",
          phone: d["Member Phone"] || d["Official Phone"] || "",
          email: d["Official Email"] || "",
          address: `${d["Address Line"] || ""}, ${d["City"] || ""}, ${d["State"] || ""} ${d["Pincode"] || ""}`,
          website: d["Website URL"] || "www.botivate.in",
          logo: finalLogo,
        });
      } else {
        console.error("Event not found in response:", res);
      }
    } catch (err) {
      console.error("Failed to fetch event:", err);
    } finally {
      setLoading(false);
    }
  };

  const getQRSize = (baseSize: number) => {
    if (screenSize.width < 640) return baseSize - 50
    if (screenSize.width < 1024) return baseSize - 20
    return baseSize
  }

  const generateVCard = (contact: ContactInfo): string => {
    return `BEGIN:VCARD
VERSION:3.0
N:${contact.lastName};${contact.firstName};;;
FN:${contact.firstName} ${contact.lastName}
TITLE:${contact.title}
ORG:${contact.organization}
TEL:+91${contact.phone}
EMAIL:${contact.email}
ADR:;;${contact.address};;;;
URL:${contact.website}
END:VCARD`.trim()
  }

  const generateQRCodeDataURL = async (text: string, options = {}): Promise<string> => {
    try {
      const qrOptions = {
        errorCorrectionLevel: "H",
        type: "image/png" as const,
        quality: 0.95,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        width: 500,
        ...options,
      } as const;

      const dataURL = await QRCodeLib.toDataURL(text, qrOptions) as string;
      return dataURL
    } catch (error) {
      console.error("QR Code generation failed:", error)
      throw error
    }
  }

  const loadImageAsDataURL = (imgId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.getElementById(imgId) as HTMLImageElement
      if (!img) {
        console.error(`Image with id ${imgId} not found`)
        reject(new Error(`Image with id ${imgId} not found`))
        return
      }

      if (img.complete && img.naturalWidth > 0) {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0)

        try {
          const dataURL = canvas.toDataURL('image/png')
          resolve(dataURL)
        } catch (error) {
          reject(error)
        }
      } else {
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width
          canvas.height = img.naturalHeight || img.height
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          ctx.drawImage(img, 0, 0)

          try {
            const dataURL = canvas.toDataURL('image/png')
            resolve(dataURL)
          } catch (error) {
            reject(error)
          }
        }

        img.onerror = () => {
          reject(new Error(`Failed to load image: ${imgId}`))
        }
      }
    })
  }

  const createCircularImage = async (imgDataURL: string, size: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.fill()

        ctx.save()

        const circleRadius = (size / 2) * 0.9
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, circleRadius, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()

        const imgAspect = img.width / img.height
        let drawWidth, drawHeight, drawX, drawY

        if (imgAspect > 1) {
          drawHeight = circleRadius * 2 * 0.85
          drawWidth = drawHeight * imgAspect
        } else {
          drawWidth = circleRadius * 2 * 0.85
          drawHeight = drawWidth / imgAspect
        }

        drawX = (size - drawWidth) / 2
        drawY = (size - drawHeight) / 2

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

        ctx.restore()

        ctx.strokeStyle = '#E5E7EB'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, (size / 2) - 2, 0, Math.PI * 2)
        ctx.stroke()

        try {
          const circularDataURL = canvas.toDataURL('image/png')
          resolve(circularDataURL)
        } catch (error) {
          reject(error)
        }
      }
      img.onerror = () => reject(new Error('Failed to load image for circular conversion'))
      img.src = imgDataURL
    })
  }

  const downloadContactPDF = async () => {
    if (!contactInfo) return;
    try {
      await new Promise(resolve => setTimeout(resolve, 100))
      const pdf = new jsPDF("p", "mm", "a4")
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      pdf.setFillColor(255, 255, 255)
      pdf.rect(0, 0, pageWidth, pageHeight, "F")

      try {
        const vCardData = generateVCard(contactInfo)

        const contactQRDataURL = await generateQRCodeDataURL(vCardData, {
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
          width: 600,
        })

        const qrSize = 100
        const qrX = (pageWidth - qrSize) / 2
        const qrY = 80

        pdf.addImage(contactQRDataURL, "PNG", qrX, qrY, qrSize, qrSize)

        try {
          const logoDataURL = await loadImageAsDataURL('botivate-logo')
          const circularLogoDataURL = await createCircularImage(logoDataURL, 400)

          const logoSize = 40
          const logoX = qrX + (qrSize - logoSize) / 2
          const logoY = qrY + (qrSize - logoSize) / 2

          pdf.addImage(circularLogoDataURL, "PNG", logoX, logoY, logoSize, logoSize)
        } catch (error) {
          console.error("Logo error:", error)
        }

        const textY = qrY + qrSize + 20
        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(24)
        pdf.setFont("helvetica", "bold")
        pdf.text("Save Us", pageWidth / 2, textY, { align: "center" })

        const textWidth = pdf.getTextWidth("Save Us")
        const underlineY = textY + 2
        const underlineStartX = (pageWidth - textWidth) / 2
        const underlineEndX = (pageWidth + textWidth) / 2
        pdf.setLineWidth(0.8)
        pdf.line(underlineStartX, underlineY, underlineEndX, underlineY)

      } catch (error) {
        console.error("Contact QR code generation failed:", error)
      }

      pdf.save(`${contactInfo.firstName}-Contact-QR.pdf`)
    } catch (error) {
      console.error("Error generating Contact PDF:", error)
      alert("There was an error generating the Contact PDF. Please try again.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
           <p className="text-gray-600 font-medium">Loading Scanner...</p>
        </div>
      </div>
    );
  }

  if (!contactInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <p className="text-gray-500">No scanner data available.</p>
      </div>
    );
  }

  const vCardData = generateVCard(contactInfo)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 p-4 sm:p-6 lg:p-8">
      <img
        id="botivate-logo"
        src={contactInfo.logo}
        alt="Botivate Logo"
        className="hidden"
        crossOrigin="anonymous"
      />

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 sm:mb-12 bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-white/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-400/5 to-blue-500/5"></div>

          <div className="flex flex-col items-center justify-center mb-6 relative z-10">
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full group-hover:bg-blue-500/30 transition-all"></div>
              <div className="relative p-1 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-3xl shadow-2xl">
                <div className="bg-white p-2 rounded-2xl overflow-hidden">
                  <img
                    src={contactInfo.logo}
                    alt="Botivate Logo"
                    className="h-20 sm:h-24 w-20 sm:w-24 object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-4 leading-normal">
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent inline-block pb-3 pt-1">
              {contactInfo.organization}
            </span>
          </h1>
          <p className="text-lg sm:text-xl lg:text-2xl text-gray-700 font-semibold mb-1 sm:mb-2 pb-1 leading-normal inline-block w-full">
            Automated Intelligence Sync
          </p>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 pb-2 inline-block w-full">
            Professional Contact QR Card
          </p>
        </div>

        <div className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm relative overflow-hidden mb-8 rounded-2xl">
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-2xl text-center p-6">
            <h2 className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-xl sm:text-2xl font-bold mb-2">
              <QrCode className="h-6 w-6 sm:h-8 sm:w-8" />
              Save Us
            </h2>
            <p className="text-slate-200 text-base sm:text-lg">
              Scan to instantly save contact information
            </p>
          </div>

          <div className="p-6 sm:p-8 lg:p-12 text-center bg-gradient-to-br from-gray-50 to-white">
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-600 rounded-2xl sm:rounded-3xl blur-xl sm:blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 animate-pulse"></div>

                <div
                  id="qr-code"
                  className="relative bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl shadow-2xl border-2 sm:border-4 border-gray-100 transform hover:scale-105 transition-all duration-500"
                >
                  <style>{`
                    #qr-code image {
                      border-radius: 50%;
                    }
                  `}</style>
                  <QRCodeSVG
                    value={vCardData}
                    size={getQRSize(300)}
                    level="H"
                    includeMargin={true}
                    fgColor="black"
                    bgColor="#ffffff"
                    imageSettings={{
                      src: contactInfo.logo,
                      height: 70,
                      width: 70,
                      excavate: true,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="bg-gradient-to-br from-slate-700 to-slate-900 text-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-xl">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 text-center pb-1">
                  {contactInfo.firstName.toUpperCase()} {contactInfo.lastName.toUpperCase()}
                </h3>
                <p className="text-sm sm:text-base lg:text-lg text-gray-200 mb-3 sm:mb-4 text-center">
                  {contactInfo.title}
                </p>

                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-blue-400" />
                    <span className="text-sm sm:text-base font-semibold">+91 {contactInfo.phone}</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-blue-400" />
                    <span className="text-xs sm:text-sm break-all">{contactInfo.email}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-xl border-2 border-gray-100 text-left">
                <div className="space-y-3 text-sm sm:text-base text-gray-700">
                  <div className="flex items-start">
                    <MapPin className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-1" />
                    <p className="leading-relaxed">{contactInfo.address}</p>
                  </div>
                  <div className="flex items-center">
                    <Globe className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                    <a
                      href={`https://${contactInfo.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      {contactInfo.website}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <button
                onClick={downloadContactPDF}
                className="w-full sm:w-auto bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white font-bold py-3 sm:py-4 px-8 sm:px-12 rounded-xl sm:rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300 text-base sm:text-lg"
              >
                <Download className="inline-block h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" />
                Download Contact PDF
              </button>
            </div>
          </div>
        </div>

        <div className="text-center bg-gradient-to-r from-slate-700 to-slate-900 text-white p-6 sm:p-8 rounded-xl sm:rounded-2xl shadow-2xl">
           <span className="text-2xl sm:text-4xl font-bold">Botivate</span>
          <p className="text-slate-300 text-lg sm:text-xl font-semibold mb-2">Powering Businesses On Autopilot</p>
        </div>
      </div>
    </div>
  )
}

export default App
