// Import jQuery and Fabric.js
const $ = window.$
//const fabric = window.fabric    

$(document).ready(() => {
  // Check if Fabric.js is loaded
  if (typeof fabric === "undefined") {
    console.error("Fabric.js not loaded")
    alert("Failed to load required libraries. Please refresh the page.")
    return
  }

  console.log("Fabric.js loaded successfully, version:", fabric.version);

  // Default font and weight
const DEFAULT_FONT_FAMILY = 'Poppins';
const DEFAULT_FONT_WEIGHT = 600;

// Apply as Fabric defaults
fabric.Textbox.prototype.fontFamily = DEFAULT_FONT_FAMILY;
fabric.Textbox.prototype.fontWeight = DEFAULT_FONT_WEIGHT;

// If you also use fabric.IText or fabric.Text
fabric.IText.prototype.fontFamily = DEFAULT_FONT_FAMILY;
fabric.IText.prototype.fontWeight = DEFAULT_FONT_WEIGHT;
 
 


  // Constants
let CANVAS_SIZE = 1000;
let EXPORT_MULTIPLIER = 6.6;
let EXPORT_SIZE = 6600;
let CANVAS_WIDTH = 1000;  // default
let CANVAS_HEIGHT = 1000; // default
let DEFAULT_ZOOM = 0;
const DPI = 300; // print resolution
const PREVIEW_SIZE = 1000; // editing canvas max side (like before)

let aiJobAbortController = null;
let aiJobCancelled = false;

  // Global variables
// Global variables
let fabricCanvas
let selectedObject = null
let activePanel = null
let history = []
let historyIndex = -1
let isLoadingFromHistory = false
let zoom = 100
let canvasBackgroundColor = "#ffffff"
let isCanvasTransparent = false
let exportWithBackground = false
let bgRemoveImage = "https://cdn.shopify.com/s/files/1/0558/0265/8899/files/Asset_2.svg?v=1757434972";
let bgRemoveRevert = "https://cdn.shopify.com/s/files/1/0558/0265/8899/files/Asset_1_1.svg?v=1757434972"

// Stroke & Shadow System Variables
// Stroke System Variables
let currentStrokeStyle = "none";
let currentStrokeColor = "#000000";
let currentStrokeWidth = 0;
let currentEdgeStyle = "round";
let activeColorPanel = "fill"; // 'fill' or 'stroke'
window.currentSelectedImageObject = null;
let aiTriggerShowTimer = null;
let isCanvasTransforming = false;
let placementIndex = 0;   // shared counter
const placementStep = 30; // distance between objects
 

function addObjectToCanvas(obj, canvas) {

  // Always center origin
  obj.set({
    originX: 'center',
    originY: 'center'
  });

  // Add first
  canvas.add(obj);

  // Get REAL center considering zoom
  const zoom = canvas.getZoom();

  const centerX = (canvas.getWidth() / 2) / zoom;
  const centerY = (canvas.getHeight() / 2) / zoom;

  const offset = placementStep * placementIndex;

  obj.set({
    left: centerX + offset,
    top: centerY + offset
  });

  obj.setCoords();

  placementIndex++;

  canvas.setActiveObject(obj);
  canvas.requestRenderAll();
}



const AI_STATES_STUDIO = {
  ORIGINAL: "original",
  PROCESSING: "processing",
  RESULT: "result",
  RESULT_ORG: "result-org"
};

function setAIState(state) {
  const $box = $(".ai-preview-box");

  // Fade transition
  $box.addClass("ai-fade");
  setTimeout(() => $box.removeClass("ai-fade"), 250);

  // Reset UI
  $("#customer_image_preview-2, #ai_image_preview-2").hide();
  $(".ai-processing").hide();
  $(".ai-prompt-box").hide();
  $(".ai-action-box").hide();
  $(".ai-tabs").removeClass("active");
  $(".ai-tab").removeClass("active");
  $(".black-bg").hide();
  $(".ai-modal").removeClass("ai-is-processing");
  $(".ai-action-box .button").hide();

  // Tabs reset when needed
  if (state === AI_STATES_STUDIO.ORIGINAL) {    
    $('.ai-tab[data-tab="original"]').addClass("active");
    $("#customer_image_preview-2").show();
    $(".ai-prompt-box").show();
  }

  if (state === AI_STATES_STUDIO.PROCESSING) {  
    $(".ai-processing").show();
    $(".ai-modal").addClass("ai-is-processing");
  }

  if (state === AI_STATES_STUDIO.RESULT) { 
    $(".ai-tabs").addClass("active");
    $('.ai-tab[data-tab="ai"]').addClass("active");
    $("#ai_image_preview-2").show();
    $(".ai-action-box").show();
    $(".black-bg").css({"display":"flex"});
    $(".ai-action-box .button#use_ai_image-2").show();
  }

  if (state === AI_STATES_STUDIO.RESULT_ORG) { 
    $(".ai-tabs").addClass("active");
    $('.ai-tab[data-tab="original"]').addClass("active");
    $("#customer_image_preview-2").show();
    $(".ai-action-box").show();
    $(".black-bg").hide();
    $(".ai-action-box .button:not(#use_ai_image-2)").show();
  }
}

  // Initialize the editor
  // Initialize the editor
// Initialize the editor
// ✔ keep exactly as you shared
async function nanoBananaEditRequest(imageUrl, promptText) {
  aiJobCancelled = false;
  aiJobAbortController = new AbortController();
  const FAL_KEY = 'be8d6227-0af0-4f18-ac79-14111cef50cb:a8a72b50bf97f848e1144bd9c5481f0f';
  const AUTH_HEADER = 'Key ' + FAL_KEY;

  const queueResponse = await fetch('https://queue.fal.run/fal-ai/nano-banana/edit', {
    method: 'POST',
    headers: {
      'Authorization': AUTH_HEADER,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: promptText,
      num_images: 1,
      aspect_ratio: 'auto',
      output_format: 'png',
      image_urls: [imageUrl]
    })
  });

  if (!queueResponse.ok) {
    const txt = await queueResponse.text().catch(() => '');
    throw new Error('Failed to queue request (' + queueResponse.status + '): ' + txt);
  }

  const job = await queueResponse.json();

  if (!job.status_url || !job.response_url) {
    console.log('nanoBanana job payload:', job);
    throw new Error('Invalid response from nano-banana queue');
  }

  const statusUrl = job.status_url;
  const resultUrl = job.response_url;

  let attempts = 0;
  const maxAttempts = 40;

  while (attempts < maxAttempts) {
    attempts++;

    const statusResp = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Authorization': AUTH_HEADER },
      signal: aiJobAbortController.signal
    });

    const statusJson = await statusResp.json();

    if (statusJson.status === 'COMPLETED') break;

    if (
      statusJson.status === 'FAILED' ||
      statusJson.status === 'CANCELLED' ||
      statusJson.status === 'ERROR'
    ) {
      throw new Error('nano-banana request failed with status: ' + statusJson.status);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  if (aiJobCancelled) {
    throw new Error("AI request cancelled by user");
  }

  const resultResp = await fetch(resultUrl, {
    method: 'GET',
    headers: { 'Authorization': AUTH_HEADER }
  });

  const resultJson = await resultResp.json();

console.log("nanoBanana resultJson:", resultJson);

let images = [];

// Standard
if (Array.isArray(resultJson.images)) images = resultJson.images;

// Common variants
if (!images.length && Array.isArray(resultJson.output?.images)) images = resultJson.output.images;
if (!images.length && Array.isArray(resultJson.data?.images)) images = resultJson.data.images;
if (!images.length && Array.isArray(resultJson.response?.images)) images = resultJson.response.images;

// Single-image cases
let single =
  resultJson.image ||
  resultJson.output?.image ||
  resultJson.result?.image ||
  resultJson?.data?.image ||
  null;

if (!images.length && single) {
  images = [single];
}

// FINAL fallback — sometimes API returns { url: ... }
if (!images.length && resultJson.url) {
  images = [{ url: resultJson.url }];
}

// 🔴 If STILL nothing — show payload instead of a blind error
if (!images.length) {
  console.error("nanoBanana unknown payload format:", resultJson);
  throw new Error("nano-banana returned no image URLs");
}

const first = images[0] ?? {};

const url =
  first.url ||
  first.image_url ||
  first.data_url ||
  first.uri ||
  first.src ||
  '';

if (!url) {
  console.error("nanoBanana image object missing URL:", first);
  throw new Error("Image object did not contain a usable URL");
}

return url;
}


 



function initEditor() {
  initCanvas()
  bindEvents()
  updateUI()
  initStrokeSystem()
  updateAllDocumentColors()
  activeColorPanel = "fill"; // Set default active panel
}

  function initCanvas() {
    try {
      fabricCanvas = new fabric.Canvas("fabric-canvas", {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        backgroundColor: "white",
        preserveObjectStacking: true
      })
      fabricCanvas.skipOffscreen = false;
      fabricCanvas.controlsAboveOverlay = true;
      fabric.Object.prototype.transparentCorners = false;
      fabric.Object.prototype.cornerColor = '#27aafa';
      fabric.Object.prototype.cornerStyle = 'circle';
 
      
      console.log("Canvas initialized successfully");
  if(document.body.id == "ninja-design-studio")
    document.querySelector(".customTabelPopup__overlay-modal").style.display = "grid"

   fabricCanvas.on("selection:created", () => {
  console.log("Selection created");
  syncFontFromCanvas();
});
fabricCanvas.on("selection:updated", () => {
  console.log("Selection updated");
  syncFontFromCanvas();
});

fabricCanvas.on("selection:cleared", () => {
  currentFont = "Poppins";
  currentWeight = 400;
});

 


fabricCanvas.on("selection:created", handleSelectionChange);
fabricCanvas.on("selection:updated", handleSelectionChange);
fabricCanvas.on("selection:cleared", () => {
  document.getElementById("ai-image-edit-panel").style.display = "none";
});

function handleSelectionChange() {
  const obj = fabricCanvas.getActiveObject();
  const panel = document.querySelector('#ai-image-edit-panel');;

  if (!obj || obj.type !== "image") {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";
 
}
 

fabricCanvas.on('selection:created', e => {
  const obj = e.selected?.[0];
  if (obj?.type === 'image') {
    window.currentSelectedImageObject = obj;
  }
});

fabricCanvas.on('selection:updated', e => {
  const obj = e.selected?.[0];
  if (obj?.type === 'image') {
    window.currentSelectedImageObject = obj;
  }
});



$(document).on('click', '#use_ai_image-2', async function () {
  const obj = window.currentSelectedImageObject;
  if (!obj) return;

  const aiTempUrl = $(this).data('ai-url');
  if (!aiTempUrl) return;

  const $btn = $(this); 

  try {
    lockEditorProcessingState(true);
    $('.customTabelPopup__overlay-ai-2').addClass('ai-overlay-locked');
    $btn.prop('disabled', true).html('Applying...');

    // 1️⃣ Download AI image
    const res = await fetch(aiTempUrl);
    const blob = await res.blob();
    const file = new File([blob], 'ai-edit.png', { type: blob.type });

    // 2️⃣ Upload to S3
    const fileName = `ai_edit____image_${Date.now()}_${Math.floor(Math.random()*1000)}.png`;
    const presignData = await getPresignedUploadUrl(fileName, file.type);

    await fetch(presignData.url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    // 3️⃣ Imgix URL
    let imgixUrl = presignData.sourceUrl
      .replace(
        "ninja-services-production-ninjauploadss3bucket-zks2mguobhe4.s3.amazonaws.com",
        "ninjauploads-production.imgix.net"
      )
      .split("?")[0] + "?bg-remove=true";

    // 4️⃣ WAIT until Fabric finishes loading image
    const img = await new Promise((resolve, reject) => {
      fabric.Image.fromURL(
        imgixUrl,
        i => i ? resolve(i) : reject("Fabric failed to load image"),
        { crossOrigin: 'anonymous' }
      );
    });

    // 5️⃣ Replace object ONLY when bitmap is ready
    img.set({
      left: obj.left,
      top: obj.top,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      angle: obj.angle,
    });

    img._originalUrl = imgixUrl.split('?')[0];   // clean base for bg toggle
    img._bgRemoved = true;
    img.isAIEdit = true;

    fabricCanvas.remove(obj);
    fabricCanvas.add(img);
    fabricCanvas.setActiveObject(img);
    fabricCanvas.requestRenderAll();

  } catch (e) {
    console.error(e);
    alert("Failed to apply AI image");
  } finally {
    $('.customTabelPopup__overlay-ai-2').removeClass('ai-overlay-locked').hide();
    $('body').removeClass('lock-page');
    document.querySelector('body').classList.remove("hide-chat");
    $btn.prop('disabled', false).html("Apply AI Edit");
    lockEditorProcessingState(false);
  }
});


$(document).on("click", "#ai_stop_processing-2", function () {
  aiJobCancelled = true;
  if (aiJobAbortController) aiJobAbortController.abort();
  setAIState(AI_STATES_STUDIO.ORIGINAL);
});

$(document).on("click", ".ai-tab", function () {

  $(".ai-tab").removeClass("active");
  $(this).addClass("active");

  const tab = $(this).data("tab");

  if (tab === "original") {
    setAIState(AI_STATES_STUDIO.RESULT_ORG);
  }

  if (tab === "ai") {
    setAIState(AI_STATES_STUDIO.RESULT);
  }
});

$("#ai_reset_editor-2").on("click", function () {
   $("#ai_prompt_2-2").val("");
  setAIState(AI_STATES_STUDIO.ORIGINAL);
});


$(document).on('click', '#ai-edit-trigger', function () {
  const obj = window.currentSelectedImageObject;

  if (!obj || obj.type !== 'image') {
    alert('Please select an image first');
    return;
  }

  const previewUrl = obj._originalUrl || obj.src;

  $('#customer_image_preview-2').attr('src', previewUrl);
  $('#ai_image_preview-2').attr('src', '');
  $('#ai_prompt_2-2').val('');

  $('.customTabelPopup__overlay-ai-2').show();
  $('body').addClass('lock-page');
  document.querySelector('body').classList.remove("hide-chat");

  setAIState(AI_STATES_STUDIO.ORIGINAL);
});


$(document).on('click', '#ai_generate_image_2-2', async function () {
  const obj = window.currentSelectedImageObject;
  if (!obj) return;

  const prompt = ($('#ai_prompt_2-2').val() || '').trim();
  if (!prompt) return;

  setAIState(AI_STATES_STUDIO.PROCESSING);

  try {
    const baseImageUrl = obj._originalUrl;
    const aiUrl = await nanoBananaEditRequest(baseImageUrl, prompt);

    $('#ai_image_preview-2').attr('src', aiUrl);

    // cache AI url for Apply step
    $('#use_ai_image-2').data('ai-url', aiUrl);

    setAIState(AI_STATES_STUDIO.RESULT);
  } catch (err) {
    console.error(err);
   // alert(err.message || 'AI failed');
    setAIState(AI_STATES_STUDIO.ORIGINAL);
  }
});

// ===========================
// FONT SELECTOR MODULE (FINAL)
// ===========================
 const googleFontMeta = {
  // === Popular ===
  "Poppins": [100,200,300,400,500,600,700,800,900],
  "Roboto": [100,300,400,500,700,900],
  "Open Sans": [300,400,500,600,700,800],
  "Lato": [100,300,400,700,900],
  "Montserrat": [100,200,300,400,500,600,700,800,900],
  "Oswald": [200,300,400,500,600,700],
  "Raleway": [100,200,300,400,500,600,700,800,900],
  "Nunito": [200,300,400,600,700,800,900],
  "Rubik": [300,400,500,600,700,800,900],
  "Work Sans": [100,200,300,400,500,600,700,800,900],
  "Inter": [100,200,300,400,500,600,700,800,900],
  "Outfit": [100,200,300,400,500,600,700,800,900],
  "Barlow": [100,200,300,400,500,600,700,800,900],
  "Urbanist": [100,200,300,400,500,600,700,800,900],
  "DM Sans": [400,500,700],
  "Manrope": [200,300,400,500,600,700,800],
  "Playfair Display": [400,500,600,700,800,900],
  "Merriweather": [300,400,700,900],
  "Noto Sans": [100,200,300,400,500,600,700,800,900],
  "Ubuntu": [300,400,500,700],
  "Fira Sans": [100,200,300,400,500,600,700,800,900],
  "PT Sans": [400,700],
  "Exo 2": [100,200,300,400,500,600,700,800,900],
  "Mulish": [200,300,400,500,600,700,800,900],
  "Karla": [200,300,400,500,600,700,800],
  "Hind": [300,400,500,600,700],
  "Quicksand": [300,400,500,600,700],
  "Source Sans 3": [200,300,400,500,600,700,800,900],
  "Jost": [100,200,300,400,500,600,700,800,900],
  "Arimo": [400,500,600,700],
  "Cabin": [400,500,600,700],
  "Titillium Web": [200,300,400,600,700,900],
  "Mukta": [200,300,400,500,600,700,800],
  "Assistant": [200,300,400,600,700,800],
  "Varela Round": [400],
  "Public Sans": [100,200,300,400,500,600,700,800,900],
  "Signika": [300,400,500,600,700],
  "Overpass": [100,200,300,400,500,600,700,800,900],
  "Heebo": [100,200,300,400,500,600,700,800,900],
  "IBM Plex Sans": [100,200,300,400,500,600,700],
  "Cairo": [200,300,400,600,700,900],
  "Red Hat Display": [400,500,600,700,800,900],
  "Prompt": [100,200,300,400,500,600,700,800,900],
  "Tajawal": [200,300,400,500,700,800,900],
  "Noto Serif": [100,200,300,400,500,600,700,800,900],
  "Barlow Condensed": [100,200,300,400,500,600,700,800,900],
  "Lexend": [100,200,300,400,500,600,700,800,900],
  "Hind Siliguri": [300,400,500,600,700],
  "Be Vietnam Pro": [100,200,300,400,500,600,700,800,900],
  "Noto Sans Display": [100,200,300,400,500,600,700,800,900],

  // === Modern ===
  "Sora": [100,200,300,400,500,600,700,800],
  "Plus Jakarta Sans": [200,300,400,500,600,700,800],
  "Kumbh Sans": [100,200,300,400,500,600,700,800,900],
  "Figtree": [300,400,500,600,700,800,900],
  "Teko": [300,400,500,600,700],
  "Anton": [400],
  "Orbitron": [400,500,600,700,800,900],
  "Rajdhani": [300,400,500,600,700],
  "Space Grotesk": [300,400,500,600,700],
  "Syne": [400,500,600,700,800],
  "Quantico": [400,700],
  "Michroma": [400],
  "Audiowide": [400],
  "Jura": [300,400,500,600,700],
  "Varta": [300,400,500,600,700],
  "Questrial": [400],
  "Chivo": [300,400,700,900],
  "Sarabun": [100,200,300,400,500,600,700,800],
  "Asap": [400,500,600,700],
  "Coda": [400,800],
  "Anek Latin": [100,200,300,400,500,600,700,800],
  "Hanken Grotesk": [100,200,300,400,500,600,700,800,900],
  "Livvic": [100,200,300,400,500,600,700,800,900],
  "Exo": [100,200,300,400,500,600,700,800,900],
  "Pathway Extreme": [100,200,300,400,500,600,700,800,900],
  "Atkinson Hyperlegible": [400,700],
  "Encode Sans": [100,200,300,400,500,600,700,800,900],
  "Bai Jamjuree": [200,300,400,500,600,700],
  "Sen": [400,700,800],
  "Readex Pro": [200,300,400,500,600,700],

  // === Classic ===
  "Times New Roman": [400,700],
  "Crimson Text": [400,600,700],
  "Cormorant": [300,400,500,600,700],
  "Libre Baskerville": [400,700],
  "Domine": [400,500,600,700],
  "Lora": [400,500,600,700],
  "EB Garamond": [400,500,600,700,800],
  "Tinos": [400,700],
  "Spectral": [200,300,400,500,600,700,800],
  "Vollkorn": [400,500,600,700,800,900],
  "Cardo": [400,700],
  "PT Serif": [400,700],
  "Old Standard TT": [400,700],
  "Cormorant Garamond": [300,400,500,600,700],
  "Zilla Slab": [300,400,500,600,700],
  "Bitter": [100,200,300,400,500,600,700,800,900],
  "Nanum Myeongjo": [400,700,800],
  "Gentium Book Plus": [400,700],
  "Alegreya": [400,500,600,700,800,900],
  "Brawler": [400],
  "Sorts Mill Goudy": [400],
  "DM Serif Text": [400],
  "Arapey": [400,700],
  "Taviraj": [100,200,300,400,500,600,700,800,900],
  "Rokkitt": [100,200,300,400,500,600,700,800,900],
  "Inknut Antiqua": [300,400,500,600,700,800,900],
  "Ledger": [400],
  "Trirong": [100,200,300,400,500,600,700,800,900],
  "Noticia Text": [400,700],
  "Alice": [400],
  "Neuton": [200,300,400,700,800],
  "Judson": [400,700],
  "Rasa": [300,400,500,600,700],
  "Coustard": [400,900],
  "Lustria": [400],
  "Suranna": [400],
  "Rhodium Libre": [400],
  "Mate": [400,700],
  "Noto Serif Display": [100,200,300,400,500,600,700,800,900],
  "Cormorant Infant": [300,400,500,600,700],
  "Gloock": [400],
  "Fraunces": [100,200,300,400,500,600,700,800,900],
  "IBM Plex Serif": [100,200,300,400,500,600,700],
  "Prata": [400],
  "Adamina": [400],
  "Maitree": [200,300,400,500,600,700],
  "Rosarivo": [400],

  // === Playful ===
  "Fredoka": [300,400,500,600,700],
  "Baloo 2": [400,500,600,700,800],
  "Chewy": [400],
  "Bungee": [400],
  "Permanent Marker": [400],
  "Luckiest Guy": [400],
  "Shadows Into Light": [400],
  "Comic Neue": [300,400,700],
  "Handlee": [400],
  "Patrick Hand": [400],
  "Bubblegum Sans": [400],
  "Carter One": [400],
  "Sigmar": [400],
  "Boogaloo": [400],
  "Chicle": [400],
  "Titan One": [400],
  "Leckerli One": [400],
  "Righteous": [400],
  "Skranji": [400,700],
  "Acme": [400],
  "Amaranth": [400,700],
  "Bangers": [400],
  "Black Ops One": [400],
  "Lalezar": [400],
  "Paytone One": [400],
  "Rock Salt": [400],
  "Ravi Prakash": [400],
  "Special Elite": [400],
  "Knewave": [400],
  "Kaushan Script": [400],
  "Press Start 2P": [400],
  "Rye": [400],
  "Audiowide": [400],
  "Sniglet": [400,800],
  "Cabin Sketch": [400,700],
  "Creepster": [400],
  "Coiny": [400],
  "Caveat Brush": [400],
  "Berkshire Swash": [400],
  "Bungee Inline": [400],
  "Bungee Shade": [400],
  "Bungee Hairline": [400],
  "Fugaz One": [400],
  "Gochi Hand": [400],
  "Modak": [400],
  "Oleo Script": [400,700],
  "Nova Round": [400],
  "Salsa": [400],
  "Ranchers": [400],
  "ZCOOL KuaiLe": [400],

  // === Handwritten ===
  "Dancing Script": [400,500,600,700],
  "Pacifico": [400],
  "Satisfy": [400],
  "Caveat": [400,500,600,700],
  "Amatic SC": [400,700],
  "Great Vibes": [400],
  "Sacramento": [400],
  "Gloria Hallelujah": [400],
  "Cookie": [400],
  "Alex Brush": [400],
  "Parisienne": [400],
  "Tangerine": [400,700],
  "Marck Script": [400],
  "Allura": [400],
  "Arizonia": [400],
  "Merienda": [400,700],
  "Yesteryear": [400],
  "Bad Script": [400],
  "Nanum Pen Script": [400],
  "Reenie Beanie": [400],
  "La Belle Aurore": [400],
  "Kalam": [300,400,700],
  "Covered By Your Grace": [400],
  "Calligraffitti": [400],
  "Architects Daughter": [400],
  "Nothing You Could Do": [400],
  "Just Another Hand": [400],
  "Beth Ellen": [400],
  "Cedarville Cursive": [400],
  "Clicker Script": [400],
  "Dawning of a New Day": [400],
  "Give You Glory": [400],
  "Homemade Apple": [400],
  "Italianno": [400],
  "Mrs Saint Delafield": [400],
  "Sofia": [400],
  "Sriracha": [400],
  "Qwigley": [400],
  "Zeyada": [400],
  "Norican": [400],
  "Rouge Script": [400],
  "Herr Von Muellerhoff": [400],
  "Pinyon Script": [400]
};

 

/***********************
  Font selector module
  - Document Fonts (live)
  - Category tabs + accordion weights
  - Works with Fabric canvas (fabricCanvas)
***********************/

// ensure googleFontMeta exists (if you have it elsewhere, this won't overwrite it)
 

// === HELPERS ===
const getWeightLabel = w => ({
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi-Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black"
}[w] || w);

const loadedFonts = new Set();
function loadGoogleFont(fontName) {
  if (!fontName) return;
  if (loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);
  if (typeof WebFont !== "undefined" && WebFont && WebFont.load) {
    WebFont.load({
      google: { families: [`${fontName}:${(googleFontMeta[fontName] || [400]).join(",")}`] }
    });
  }
}

// normalize font name used for matching (strip quotes, take first family)
function normalizeFontName(name) {
  if (!name) return "";
  let n = String(name).split(",")[0].replace(/['"]/g, "").trim();
  // remove trailing -Bold / -Regular pieces (common bundling)
  n = n.split("-")[0].trim();
  return n;
}

// ensure a select has an option (append if missing)
function ensureSelectOption(selectSelector, value, label) {
  const sel = document.querySelector(selectSelector);
  if (!sel || value == null) return;
  const v = String(value);
  if (![...sel.options].some(o => o.value === v)) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.text = label || v;
    sel.appendChild(opt);
  }
}

// updateTextProperty: safe setter for active Fabric text object
function updateTextProperty(prop, val) {
  const canvas = window.fabricCanvas || (typeof fabricCanvas !== "undefined" && fabricCanvas);
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj) return;
  if (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") {
    const props = {};
    props[prop] = val;
    obj.set(props);

    // fabric text sometimes needs additional measures for weight as string
    try {
      canvas.requestRenderAll();
    } catch (e) {
      if (canvas.renderAll) canvas.renderAll();
    }
  }
}

// === STATE ===
let currentFont = "Poppins";
let currentWeight = 400;
let currentCategory = "Popular";
let searchTerm = "";

// === FONT CATEGORIES (use your original list) ===
const fontCategories = {
  "Popular": [
    "Roboto","Open Sans","Lato","Poppins","Montserrat","Raleway","Nunito","Playfair Display","Oswald","Work Sans",
    "Rubik","Inter","Merriweather","DM Sans","Barlow","Noto Sans","Ubuntu","Quicksand","Source Sans 3","Manrope",
    "Jost","Mulish","Fira Sans","Karla","Assistant","PT Sans","Overpass","Signika","Heebo","IBM Plex Sans",
    "Public Sans","Be Vietnam Pro","Lexend","Prompt","Barlow Condensed","Noto Serif","Cairo","Red Hat Display",
    "Titillium Web","Hind","Cabin","Arimo","Lora","DM Serif Display","Noto Serif Display","Noto Sans Display",
    "Urbanist","Varela Round","Tajawal","Hind Siliguri"
  ],
  "Modern": [
    "Outfit","Sora","Urbanist","Barlow","Inter","DM Sans","Manrope","Plus Jakarta Sans","Red Hat Display","Rubik",
    "Mulish","Kumbh Sans","Lexend","Noto Sans","Public Sans","Prompt","Teko","Anton","Orbitron","Rajdhani",
    "Titillium Web","Space Grotesk","Syne","Arimo","Quantico","Michroma","Audiowide","Be Vietnam Pro","Jura",
    "Varta","Questrial","Chivo","Sarabun","Asap","Coda","Anek Latin","Hanken Grotesk","Livvic","Exo 2",
    "Pathway Extreme","Atkinson Hyperlegible","Encode Sans","Bai Jamjuree","Sen","Heebo","Jost","Readex Pro"
  ],
  "Classic": [
    "Playfair Display","Merriweather","Crimson Text","Libre Baskerville","Domine","Lora","EB Garamond","Spectral",
    "Noto Serif","Cardo","Cormorant Garamond","Zilla Slab","Bitter","Nanum Myeongjo","Alegreya","Gentium Book Plus",
    "Old Standard TT","Vollkorn","PT Serif","Trirong","Ledger","Rasa","Alice","Adamina","Mate","Judson","Rosarivo",
    "Neuton","Taviraj","Rokkitt","Inknut Antiqua","Noticia Text","Fraunces","Gloock","Coustard","Cormorant Infant",
    "Cormorant","Sorts Mill Goudy","Prata","Maitree","IBM Plex Serif","Arapey","Brawler","Tinos","Noto Serif Display"
  ],
  "Playful": [
    "Fredoka","Baloo 2","Chewy","Bungee","Permanent Marker","Luckiest Guy","Comic Neue","Handlee","Patrick Hand",
    "Bubblegum Sans","Carter One","Sigmar","Boogaloo","Chicle","Titan One","Leckerli One","Righteous","Skranji","Acme",
    "Amaranth","Bangers","Black Ops One","Lalezar","Paytone One","Rock Salt","Ravi Prakash","Special Elite","Knewave",
    "Kaushan Script","Press Start 2P","Rye","Audiowide","Sniglet","Cabin Sketch","Creepster","Coiny","Caveat Brush",
    "Berkshire Swash","Bungee Inline","Bungee Shade","Bungee Hairline","Fugaz One","Gochi Hand","Modak","Oleo Script",
    "Nova Round","Salsa","Ranchers","ZCOOL KuaiLe"
  ],
  "Handwritten": [
    "Dancing Script","Pacifico","Satisfy","Caveat","Amatic SC","Great Vibes","Sacramento","Gloria Hallelujah","Cookie",
    "Kaushan Script","Alex Brush","Parisienne","Tangerine","Marck Script","Allura","Arizonia","Merienda","Yesteryear",
    "Bad Script","Nanum Pen Script","Patrick Hand","Reenie Beanie","La Belle Aurore","Kalam","Covered By Your Grace",
    "Calligraffitti","Rock Salt","Architects Daughter","Nothing You Could Do","Just Another Hand","Handlee","Beth Ellen",
    "Cedarville Cursive","Clicker Script","Dawning of a New Day","Give You Glory","Homemade Apple","Italianno",
    "Mrs Saint Delafield","Sofia","Sriracha","Qwigley","Zeyada","Norican","Rouge Script","Herr Von Muellerhoff",
    "Pinyon Script"
  ],
  "Decorative": [
    "Alfa Slab One","Abril Fatface","Cinzel Decorative","Unica One","Fascinate Inline","Rye","Monoton","Rye Display",
    "Ribeye","Bungee Outline","Bungee Shade","Diplomata","Jacques Francois Shadow","Ewert","Metal Mania","Vast Shadow",
    "Knewave","Butcherman","Pirata One","Faster One","Stalinist One","Trade Winds","Hanalei Fill",
    "Fruktur","Londrina Outline","Erica One","Nosifer","Kelly Slab","Creepster","Frijole","Gorditas",
    "Londrina Shadow","Shojumaru","Fontdiner Swanky","Miltonian Tattoo"
  ],
  "Retro": [
    "Lobster","Pacifico","Righteous","Fredoka One","Monoton","Poiret One","Fascinate","Lobster Two","Bungee Shade",
    "Bungee Inline","Sigmar One","Rye","Press Start 2P","Chewy","Berkshire Swash","Audiowide","Oleo Script","Sriracha",
    "Racing Sans One","Yellowtail","Shrikhand","Bungee","Leckerli One","Courgette","Patrick Hand SC","Sniglet","Knewave",
    "Aclonica","Chango","Coiny","Krona One","Bowlby One SC","Rye Display","Luckiest Guy","Modak","Fruktur","Hanalei",
    "Coda Caption","Kelly Slab","Ewert","Sancreek"
  ],
  "Script": [
    "Dancing Script","Pacifico","Satisfy","Allura","Alex Brush","Great Vibes","Sacramento","Tangerine","Parisienne",
    "Arizonia","Marck Script","Cookie","Bad Script","Yesteryear","Kaushan Script","Merienda","Italianno","Qwigley",
    "Herr Von Muellerhoff","Pinyon Script","Norican","Rouge Script","Zeyada","Calligraffitti","Homemade Apple",
    "Give You Glory","Sofia","Beth Ellen","La Belle Aurore","Mrs Saint Delafield","Clicker Script",
    "Architects Daughter","Nothing You Could Do","Rock Salt","Covered By Your Grace","Handlee","Patrick Hand"
  ]
};

// === Get all fonts used by canvas text objects (normalized) ===
function getDocumentFonts() {
  const fonts = new Set();
  const canvas = window.fabricCanvas || (typeof fabricCanvas !== "undefined" && fabricCanvas);
  if (!canvas || !canvas.getObjects) return [];
  canvas.getObjects().forEach(obj => {
    if (!obj) return;
    const t = (obj.type || "").toLowerCase();
    if (t === "textbox" || t === "i-text" || t === "text") {
      const ff = (obj.fontFamily || "").toString();
      const n = normalizeFontName(ff);
      if (n) fonts.add(n);
    }
  });
  return Array.from(fonts).sort((a,b)=>a.localeCompare(b));
}

// === Create accordion item (header + weight list)
// allowAutoSelectOnHeader: when true, clicking header will also select (category fonts).
// For Document Fonts we pass false so header toggles only (weights apply font).
function createAccordionItem(font, allowAutoSelectOnHeader = true, showWeights = true) {
  const item = document.createElement("div");
  item.className = "font-accordion-item";

  const header = document.createElement("div");
  header.className = "font-header";
  header.textContent = font;
  header.style.fontFamily = `'${font}', sans-serif`;

  const chevron = document.createElement("span");
  chevron.className = "chevron";
  chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path d="M0 7.33l2.829-2.83 9.175 9.339 9.167-9.339 2.829 2.83-11.996 12.17z"/></svg>`;
  header.prepend(chevron);

  header.addEventListener("click", () => {
    // toggle this item, close others
    const isOpen = item.classList.contains("open");
    document.querySelectorAll(".font-accordion-item").forEach(i => {
      if (i !== item) i.classList.remove("open");
    });
    if (!isOpen) {
      item.classList.add("open");
      // auto-select regular only for category fonts (not document fonts)
      if (allowAutoSelectOnHeader) {
        selectFont(font, 400);
      }
    } else {
      item.classList.remove("open");
    }
  });

  const weights = googleFontMeta[font] || [400];
  const list = document.createElement("div");
  list.className = "font-weight-list";

  if (showWeights) {
  const weights = googleFontMeta[font] || [400];
  const list = document.createElement("div");
  list.className = "font-weight-list";

  weights.forEach(w => {
    const btn = document.createElement("div");
    btn.className = "font-weight-item";
    btn.textContent = getWeightLabel(w);
    btn.style.fontFamily = `'${font}', sans-serif`;
    btn.style.fontWeight = w;

    const mark = document.createElement("span");
    mark.className = "checkmark";
    mark.textContent = "✔";
    mark.style.display = "none";

    if (normalizeFontName(currentFont) === normalizeFontName(font) && Number(currentWeight) === Number(w)) {
      btn.classList.add("active");
      mark.style.display = "inline-block";
    }

    btn.addEventListener("click", e => {
      e.stopPropagation();
      selectFont(font, w);
    });

    list.appendChild(btn);
  });

  item.appendChild(list);
}

  item.appendChild(header);
  item.appendChild(list);
  return item;
}

// === Render accordion (Document Fonts first, then category)
function renderFontAccordion(category) {
  currentCategory = category || currentCategory;
  const container = document.getElementById("font-accordion-container");
  if (!container) return;
  container.innerHTML = `<div class="font-loading">Loading ${currentCategory} fonts...</div>`;

  setTimeout(() => {
    container.innerHTML = "";

    // 1) Document Fonts (live list)
    const docFontsRaw = getDocumentFonts();
    const docFonts = docFontsRaw.filter(f => f.toLowerCase().includes(searchTerm));
    if (docFonts.length > 0) {
      const docSection = document.createElement("div");
      docSection.className = "font-section";
      const docTitle = document.createElement("h4");
      docTitle.className = "font-section-title";
      docTitle.textContent = "Document Fonts";
      docSection.appendChild(docTitle);

      const docGroup = document.createElement("div");
      docGroup.className = "font-group";

      docFonts.forEach(font => {
        loadGoogleFont(font);
        // allow header toggle but DO NOT auto-select on header click
        const item = createAccordionItem(font, false, false);
        docGroup.appendChild(item);
      });

      docSection.appendChild(docGroup);
      container.appendChild(docSection);
    }

    // 2) Category fonts
    const catSection = document.createElement("div");
    catSection.className = "font-section";
    const catTitle = document.createElement("h4");
    catTitle.className = "font-section-title";
    catTitle.textContent = `${currentCategory} Fonts`;
    catSection.appendChild(catTitle);

    const catGroup = document.createElement("div");
    catGroup.className = "font-group";

    // ensure category fonts loaded
    (fontCategories[currentCategory] || []).forEach(loadGoogleFont);

    const filteredFonts = (fontCategories[currentCategory] || []).filter(f => f.toLowerCase().includes(searchTerm));
    filteredFonts.forEach(font => {
      if (currentCategory === "All Fonts") {
      const item = createAccordionItem(font, true);
      catGroup.appendChild(item);
    } else {
      const item = createAccordionItem(font, true);
      catGroup.appendChild(item);
    }
    });

    if (filteredFonts.length === 0 && docFonts.length === 0) {
      const nf = document.createElement("div");
      nf.className = "font-loading";
      nf.textContent = "No fonts found";
      catGroup.appendChild(nf);
    }

    catSection.appendChild(catGroup);
    container.appendChild(catSection);

    // Reapply current selection highlight (open the selected font if present)
    reapplySelectionAfterRender();

  }, 120);
}

// highlight current font and weight after render
function reapplySelectionAfterRender() {
  const normTarget = normalizeFontName(currentFont);
  let matched = null;
  document.querySelectorAll(".font-accordion-item").forEach(item => {
    const header = item.querySelector(".font-header");
    if (!header) return;
    const headerName = normalizeFontName(header.textContent || "");
    const match = headerName === normTarget;
    item.classList.toggle("selected", match);
    if (match) {
      matched = item;
      // open matched item so user sees weights
      item.classList.add("open");
      // highlight weight
      item.querySelectorAll(".font-weight-item").forEach(btn => {
        const mark = btn.querySelector(".checkmark");
        if (btn.textContent.trim().startsWith(getWeightLabel(currentWeight))) {
          btn.classList.add("active");
          if (mark) mark.style.display = "inline-block";
        } else {
          btn.classList.remove("active");
          if (mark) mark.style.display = "none";
        }
      });
    } else {
      // remove active state on non-matches
      item.querySelectorAll(".font-weight-item").forEach(btn => {
        btn.classList.remove("active");
        const mark = btn.querySelector(".checkmark");
        if (mark) mark.style.display = "none";
      });
    }
  });

  /* if (matched) { 
    setTimeout(() => {
      try { matched.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {  }
    }, 150);
  } */
}

// refresh accordion but preserve scroll
function refreshDocumentFonts() {
  const container = document.getElementById("font-accordion-container");
  if (!container) return;
  const prevScroll = container.scrollTop;
  renderFontAccordion(currentCategory);
  setTimeout(() => { try { container.scrollTop = prevScroll; } catch(e){} }, 180);
}

// === selectFont: apply to UI and canvas (and update global defaults)
function selectFont(fontName, weight) {
  if (!fontName) return;

  // store previous font & weight for comparison
  const prevFont = currentFont;
  const prevWeight = currentWeight;

  // update current selection
  currentFont = fontName;
  currentWeight = Number(weight) || 400;

  // ensure select inputs contain this option
  ensureSelectOption("#font-family", fontName, fontName);
  ensureSelectOption("#font-weight", String(currentWeight), String(currentWeight));

  // set display label
  const selNameEl = document.querySelector("#selected_font_name");
  if (selNameEl) {
    selNameEl.textContent = fontName;
    selNameEl.style.fontFamily = `'${fontName}', sans-serif`;
    selNameEl.style.fontWeight = currentWeight;
  }

  // apply font + weight to active Fabric object
  try {
    updateTextProperty("fontFamily", fontName);
    updateTextProperty("fontWeight", currentWeight);
  } catch (e) {
    console.warn("Font apply failed:", e);
  }

  // extra safety: direct apply if updateTextProperty missed
  const canvas = window.fabricCanvas || (typeof fabricCanvas !== "undefined" && fabricCanvas);
  if (canvas && canvas.getActiveObject) {
    const obj = canvas.getActiveObject();
    if (obj && ["textbox", "i-text", "text"].includes(obj.type)) {
      try {
        obj.set({ fontFamily: fontName, fontWeight: currentWeight });
        if (canvas.requestRenderAll) canvas.requestRenderAll();
      } catch (e) {
        console.warn("Canvas font update error:", e);
      }
    }
  }

  // set defaults for future objects
  try {
    if (fabric && fabric.Textbox) {
      fabric.Textbox.prototype.fontFamily = fontName;
      fabric.Textbox.prototype.fontWeight = currentWeight;
    }
    if (fabric && fabric.IText) {
      fabric.IText.prototype.fontFamily = fontName;
      fabric.IText.prototype.fontWeight = currentWeight;
    }
  } catch (e) {
    console.warn("Default font set failed:", e);
  }

  // ✅ Re-highlight selection without full re-render (avoids flicker)
  reapplySelectionAfterRender();

  // ✅ Refresh Document Fonts only when font family changes
  if (normalizeFontName(prevFont) !== normalizeFontName(fontName)) {
    refreshDocumentFonts();
  }
}

function lockEditorProcessingState(lock) {
  const elements = document.querySelectorAll('.right-panel, .toolbar, .canvas-area'); 

  elements.forEach(el => {
    if (lock) {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.7';
    } else {
      el.style.pointerEvents = '';
      el.style.opacity = '';
    }
  });
}



document.querySelector('#ai-edit-stop')
  .addEventListener('click', () => {
    aiJobCancelled = true;
    aiJobAbortController?.abort();
    document.querySelector('#ai-edit-status').innerText =
      "Cancelled — reverted to original";
  });


  function positionAiEditTrigger(obj) {
  if (!obj || obj.type !== 'image') {
    $('#ai-edit-trigger').hide();
    return;
  }

  const canvasEl = fabricCanvas.upperCanvasEl;
  const rect = canvasEl.getBoundingClientRect();
  const zoom = fabricCanvas.getZoom();

  // Object center (canvas coords)
  const center = obj.getCenterPoint();

  // Convert canvas → screen coords
  const screenX = rect.left + center.x * zoom;
  const screenY =
    rect.top +
    (center.y + (obj.getScaledHeight() / 2) + 20) * zoom; // 20px gap

  $('#ai-edit-trigger')
    .css({
      left: `${screenX}px`,
      top: `${screenY}px`,
    })
    .fadeIn(120);
}


async function runAiEditForCanvasObject(obj) {

  obj = obj || window.currentSelectedImageObject;

  if (!obj || obj.type !== "image") {
    alert("Please select an image first.");
    return;
  }

  const status = document.querySelector('#ai-edit-status');
  const promptInput = document.querySelector('#ai-edit-prompt');
  const prompt = (promptInput.value || "").trim();

  if (!prompt) {
    status.innerText = "Please enter a prompt.";
    return;
  }

  // 🔑 SAME source BG remover relies on
  const originalUrl = obj._originalUrl || obj.src;

  if (!originalUrl) {
    status.innerText = "Original image URL not found.";
    return;
  }
  showCanvasSpinner();
  //status.innerText = "Processing…";
  lockEditorProcessingState(true);

  try {
    /* -------------------------------------------------
     1️⃣ AI EDIT (nano-banana)
    -------------------------------------------------- */
    const aiTempUrl = await nanoBananaEditRequest(originalUrl, prompt);

    /* -------------------------------------------------
     2️⃣ Download AI image → File
    -------------------------------------------------- */
    const aiResp = await fetch(aiTempUrl);
    const blob = await aiResp.blob();

    const fileType = blob.type || "image/png";
    const extension = fileType.split("/")[1] || "png";
    const nameOnly = "ai_edit";

    const file = new File([blob], "ai-edit." + extension, { type: fileType });

    /* -------------------------------------------------
     3️⃣ Upload to S3 (your existing pipeline)
    -------------------------------------------------- */
    const fileName =
      `${nameOnly}____image_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;

    const presignData = await getPresignedUploadUrl(fileName, fileType);

    if (!presignData?.url || !presignData?.sourceUrl) {
      throw new Error("Failed to get presigned URL");
    }

    await fetch(presignData.url, {
      method: "PUT",
      headers: { "Content-Type": fileType },
      body: file
    });

    /* -------------------------------------------------
     4️⃣ Convert S3 → Imgix (CRITICAL)
    -------------------------------------------------- */
    const imgixBase = presignData.sourceUrl.replace(
      "ninja-services-production-ninjauploadss3bucket-zks2mguobhe4.s3.amazonaws.com",
      "ninjauploads-production.imgix.net"
    );

    /* -------------------------------------------------
     5️⃣ Replace image in Fabric
    -------------------------------------------------- */
    fabric.Image.fromURL(
      imgixBase,
      function (img) {

        img.set({
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          crossOrigin: "anonymous"
        });

        // ✅ REQUIRED FOR BG REMOVE
        img._originalUrl = imgixBase;
        img._bgRemoved = false;

        // AI metadata
        img.isAIEdit = true;
        img._aiOriginalUrl = aiTempUrl;

        fabricCanvas.remove(obj);
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.requestRenderAll();

        status.innerText = "";
        hideCanvasSpinner();
      },
      { crossOrigin: "anonymous" }
    );

  } catch (err) {
    console.error(err);
    status.innerText = "❌ " + (err.message || "AI request failed");
  } finally {
    lockEditorProcessingState(false);
    hideCanvasSpinner();
  }
}





// sync selection -> update currentFont/currentWeight and clear search
function syncFontFromCanvas() {
  const canvas = window.fabricCanvas || (typeof fabricCanvas !== "undefined" && fabricCanvas);
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj || !(obj.type === "textbox" || obj.type === "i-text" || obj.type === "text")) return;
  const ff = (obj.fontFamily || "").toString().trim();
  const w = parseInt(obj.fontWeight) || 400;

  // normalize store
  currentFont = normalizeFontName(ff) || currentFont;
  currentWeight = Number(w) || currentWeight;

     let elem =  document.querySelector("#selected_font_name");
     elem.textContent = currentFont;
     elem.style.fontFamily = `'${currentFont}', sans-serif`;
     elem.style.fontWeight = currentWeight;

  // clear search box
  const s = document.querySelector(".font-search");
  if (s) { s.value = ""; searchTerm = ""; }

  // re-render and highlight
  renderFontAccordion(currentCategory);
  setTimeout(() => reapplySelectionAfterRender(), 250);
}




// Update colors after any text color change
$(document).on("input change", "#text-color-picker", function () {
  const color = $(this).val();
  updateTextProperty("fill", color);
   applyColorBasedOnActivePanel(color);
refreshDocumentFonts();
    $("#font-color-panel-btn .text-fill-swatch")
  .attr("data-color", color)
  .css("background-color", color);
$("#selected_font_color_name").text(color);
});



// Update colors after any text color change
// Update colors after any text stroke color change
$(document).on("input change", "#text-stroke-picker", function () {
  const color = $(this).val();
  
  // Update the global variable
  currentStrokeColor = color;
  
  // Apply to selected object
  const obj = fabricCanvas.getActiveObject();
  if (obj && (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text")) {
    obj.set({ stroke: color });
    fabricCanvas.requestRenderAll();
  }
  
  // Update UI
  $(".stroke-color").removeClass("active");
  $("#font-stroke-color-panel-btn .stroke-color")
    .attr("data-color", color)
    .css("background-color", color);
  $("#selected_font_stroke_color_name").text(color);
  
   applyColorBasedOnActivePanel(color);
});

// ---------------------------
// DROP-IN REPLACEMENT START
// ---------------------------

let isDefaultView = true; // show All Fonts + Document Fonts by default
const CATEGORY_TAB_ORDER = ["Modern","Classic","Playful","Handwritten","Decorative","Retro","Script"];
const CATEGORY_STYLE_FONTS = {
  "Modern":"Outfit", "Classic":"Playfair Display", "Playful":"Fredoka",
  "Handwritten":"Dancing Script", "Decorative":"Abril Fatface",
  "Retro":"Lobster", "Script":"Great Vibes"
};
// Fallback weights for category view when googleFontMeta has no entry (ensures chevrons/weights show)
const FALLBACK_CATEGORY_WEIGHTS = [400,700];

function renderFontTabs() {
  const tabs = document.getElementById("font-tabs-container");
  if (!tabs) return;
  tabs.innerHTML = "";

  // Search (global) — visible only in default view
  const searchBar = document.createElement("input");
  searchBar.type = "text";
  searchBar.placeholder = 'Search fonts...';
  searchBar.className = "font-search";
  searchBar.value = searchTerm || "";
  searchBar.addEventListener("input", (e) => {
    searchTerm = (e.target.value || "").toLowerCase();
    // always render All Fonts when searching
    isDefaultView = true;
    renderFontAccordion(currentCategory);
  });
  tabs.appendChild(searchBar);

  // Tab container (horizontal scroll)
  const tabWrap = document.createElement("div");
  tabWrap.className = "font-tab-wrap scrollable-tabs";

  // Add a visible "All" button (optional) that returns to default view
  const allBtn = document.createElement("button");
  allBtn.className = "font-tab";
  allBtn.textContent = "All";
  allBtn.style.fontFamily = `'${CATEGORY_STYLE_FONTS["Modern"]}', sans-serif`;
  allBtn.addEventListener("click", () => {
    isDefaultView = true;
    searchTerm = "";
    document.querySelectorAll(".font-tab").forEach(t=>t.classList.remove("active"));
    allBtn.classList.add("active");
    // show search
    const s = document.querySelector(".font-search");
    if (s) s.style.display = "block";
    renderFontAccordion(currentCategory);
  });
  tabWrap.appendChild(allBtn);

  // category tabs (Modern, Classic, etc.)
CATEGORY_TAB_ORDER.forEach(cat => {
  if (!(cat in fontCategories)) return;
  const btn = document.createElement("button");
  btn.className = "font-tab";
  btn.textContent = cat;
  btn.style.fontFamily = `'${CATEGORY_STYLE_FONTS[cat] || "Poppins"}', sans-serif`;

  btn.addEventListener("click", () => {
    const allTabs = Array.from(document.querySelectorAll(".font-tab"));
    const isActive = btn.classList.contains("active");

    if (!isActive) {
      // Enter category view
      isDefaultView = false;
      currentCategory = cat;

      // Hide all other tabs and expand current one
      allTabs.forEach(t => {
        t.style.display = (t === btn) ? "block" : "none";
      });

      btn.classList.add("active");
      btn.classList.add("full-width-tab");

      // 💡 SVG Back icon + label
      btn.innerHTML = `
        <span class="back-icon">
          <svg clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="m9.474 5.209s-4.501 4.505-6.254 6.259c-.147.146-.22.338-.22.53s.073.384.22.53c1.752 1.754 6.252 6.257 6.252 6.257.145.145.336.217.527.217.191-.001.383-.074.53-.221.293-.293.294-.766.004-1.057l-4.976-4.976h14.692c.414 0 .75-.336.75-.75s-.336-.75-.75-.75h-14.692l4.978-4.979c.289-.289.287-.761-.006-1.054-.147-.147-.339-.221-.53-.221-.191-.001-.38.071-.525.215z" fill-rule="nonzero"></path>
          </svg>
        </span>
        <span class="back-label">${cat} Fonts</span>
      `;

      // Hide search
      const s = document.querySelector(".font-search");
      if (s) s.style.display = "none";

      renderFontAccordion(cat);
    } else {
      // Exit category view → Back to All Fonts
      isDefaultView = true;
      searchTerm = "";

      // Restore all tabs
      allTabs.forEach(t => {
        t.style.display = "inline-block";
        t.classList.remove("full-width-tab", "active");
        t.textContent = t.textContent.replace(" Fonts", "").replace("← ", "");
      });

      // Reactivate "All"
      const allBtn = allTabs[0];
      if (allBtn) allBtn.classList.add("active");

      // Show search again
      const s = document.querySelector(".font-search");
      if (s) {
        s.style.display = "block";
        s.value = "";
      }

      renderFontAccordion(currentCategory);
    }
  });

  tabWrap.appendChild(btn);
  loadGoogleFont(CATEGORY_STYLE_FONTS[cat] || "Poppins");
});



  tabs.appendChild(tabWrap);
  enableTabDragScroll(tabWrap);

  // start with All view
  // make the 'All' tab visually active
  setTimeout(() => {
    document.querySelectorAll(".font-tab").forEach(t => t.classList.remove("active"));
    const b = tabWrap.querySelector(".font-tab");
    if (b) b.classList.add("active");
  }, 0);

  // render accordion
  renderFontAccordion(currentCategory);
}

function renderFontAccordion(category) {
  const container = document.getElementById("font-accordion-container");
  if (!container) return;
  container.innerHTML = ""; // clear

  // Back button (only in category view)
  if (!isDefaultView) {
    const back = document.createElement("div");
    back.className = "font-back-btn";
    back.textContent = "← All Fonts";
    back.addEventListener("click", () => {
      isDefaultView = true;
      searchTerm = "";
      const s = document.querySelector(".font-search");
      if (s) { s.value = ""; s.style.display = "block"; }
      // mark 'All' tab active
      document.querySelectorAll(".font-tab").forEach(t=>t.classList.remove("active"));
      const allTab = document.querySelector(".font-tab");
      if (allTab) allTab.classList.add("active");
      renderFontAccordion(category);
    });
   // container.appendChild(back);
  }

  // ---------- Document Fonts (only in default view) ----------
  if (isDefaultView) {
    const docFonts = getDocumentFonts().filter(f => f.toLowerCase().includes(searchTerm || ""));
    if (docFonts.length > 0) {
      const docSection = document.createElement("div");
      docSection.className = "font-section";
      const h = document.createElement("h4");
      h.className = "font-section-title";
      h.textContent = "Document Fonts";
      docSection.appendChild(h);

      const group = document.createElement("div");
      group.className = "font-group";

      docFonts.forEach(font => {
        loadGoogleFont(font);
        const item = document.createElement("div");
        item.className = "font-accordion-item document-font-item";

        const header = document.createElement("div");
        header.className = "font-header";
        header.textContent = font;
        header.style.fontFamily = `'${font}', sans-serif`;
        header.addEventListener("click", () => {
          // Document fonts apply immediately (default weight)
          selectFont(font, 400);
        });

        // mark selected
        if (normalizeFontName(currentFont) === normalizeFontName(font)) {
          item.classList.add("selected");
          header.classList.add("active");
        }

        item.appendChild(header);
        group.appendChild(item);
      });

      docSection.appendChild(group);
      container.appendChild(docSection);
    }
  }

  // ---------- ALL or CATEGORY fonts listing ----------
  // Determine which fonts to display
  let displayFonts = [];
  if (isDefaultView) {
    // combine all fonts from every category into a single list (unique)
    const all = new Set();
    Object.values(fontCategories).forEach(arr => arr.forEach(f => all.add(f)));
    displayFonts = Array.from(all).sort((a,b)=> a.localeCompare(b));
  } else {
    displayFonts = (fontCategories[category] || []).slice();
  }

  // apply search filter (search only applies in default view per your spec)
  const shown = displayFonts.filter(f => {
    if (!searchTerm) return true;
    return f.toLowerCase().includes(searchTerm);
  });

  const catSection = document.createElement("div");
  catSection.className = "font-section";
  const catTitle = document.createElement("h4");
  catTitle.className = "font-section-title";
  catTitle.textContent = isDefaultView ? "All Fonts" : `${category} Fonts`;
  catSection.appendChild(catTitle);

  const catGroup = document.createElement("div");
  catGroup.className = "font-group";

  shown.forEach(font => {
    loadGoogleFont(font);
    const item = document.createElement("div");
    item.className = "font-accordion-item";

    const header = document.createElement("div");
    header.className = "font-header";
    header.textContent = font;
    header.style.fontFamily = `'${font}', sans-serif`;

    // decide weights: use googleFontMeta if present, otherwise fallback for category view
    const availableWeights = (typeof googleFontMeta !== "undefined" && googleFontMeta[font]) ?
                              googleFontMeta[font] : (isDefaultView ? [400] : FALLBACK_CATEGORY_WEIGHTS);

    // if there are multiple weights and we're in category view, show chevron & weights
// if multiple weights, show chevron (except for Document Fonts)
    if (availableWeights.length > 1) {
      const chev = document.createElement("span");
      chev.className = "chevron";
      chev.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path d="M0 7.33l2.829-2.83 9.175 9.339 9.167-9.339 2.829 2.83-11.996 12.17z"/></svg>`;
      header.prepend(chev);
    }


      header.addEventListener("click", (e) => {
          e.stopPropagation();

          // If this is a Document font (no weights shown) OR the font has only one available weight,
          // apply immediately (no accordion).
          if (item.classList.contains("document-font-item") || availableWeights.length === 1) {
            selectFont(font, availableWeights[0]);
            return;
          }

          // Toggle open/close for fonts that have multiple weights.
          const wasOpen = item.classList.contains("open");

          // Close other open accordions
          document.querySelectorAll(".font-accordion-item.open").forEach(i => {
            if (i !== item) i.classList.remove("open");
          });

          // Toggle this one
          if (wasOpen) {
            item.classList.remove("open");
          } else {
            item.classList.add("open");
            // Smooth scroll when opening so the weights are visible
            setTimeout(() => {
              try { item.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (err) {}
            }, 100);
          }
        });






    item.appendChild(header);

    // weight list only in category view and when more than one weight available
    if (availableWeights.length > 1) {
      const list = document.createElement("div");
      list.className = "font-weight-list";
      availableWeights.forEach(w => {
        const btn = document.createElement("div");
        btn.className = "font-weight-item";
        btn.setAttribute("data-weight", String(w));
        btn.textContent = getWeightLabel(w);
        btn.style.fontFamily = `'${font}', sans-serif`;
        btn.style.fontWeight = w;

        // active highlight
        if (normalizeFontName(currentFont) === normalizeFontName(font) && Number(currentWeight) === Number(w)) {
          btn.classList.add("active");
        }

        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          selectFont(font, Number(w));
        });

        list.appendChild(btn);
      });
      item.appendChild(list);
    }

    // mark selected if it matches
    if (normalizeFontName(currentFont) === normalizeFontName(font)) item.classList.add("selected");

    catGroup.appendChild(item);
  });

  catSection.appendChild(catGroup);
  container.appendChild(catSection);

  if (shown.length === 0 && (isDefaultView ? true : false)) {
    const noresult = document.createElement("div");
    noresult.className = "font-loading";
    noresult.textContent = "No fonts found";
    container.appendChild(noresult);
  }

  // after DOM insertion, reapply highlights (existing function)
  if (typeof reapplySelectionAfterRender === "function") {
    setTimeout(() => reapplySelectionAfterRender(), 80);
  }
}

// ensure the tabs are rendered on init AND fabric listeners attached
function initFontPickerUI() {
  // Preload tab label fonts to avoid FOUT, then render tabs
  const preload = ["Poppins","Outfit","Playfair Display","Fredoka One","Dancing Script","Abril Fatface","Lobster","Great Vibes"];
  const p = preload.map(f => {
    try { return loadGoogleFont(f); } catch(e) { return Promise.resolve(); }
  });
  Promise.all(p).finally(() => {
    renderFontTabs();
    // Setup fabric canvas listeners (if you have setupCanvasListeners function)
    if (typeof setupCanvasListeners === "function") setupCanvasListeners();
  });
}

// call at script init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFontPickerUI);
} else {
  setTimeout(initFontPickerUI, 0);
}

// ---------------------------
// DROP-IN REPLACEMENT END
// ---------------------------






      
       updateLayers()
       setCanvasSizeFromInches(11, 11);

      const canvasArea = document.querySelector('.canvas-area');

      let clickedObject = false;

      // Track if Fabric selected something
      fabricCanvas.on('mouse:down', function (opt) {
          clickedObject = !!opt.target;
      });

      // Listen for clicks in the grey `.canvas-area` space
      canvasArea.addEventListener('mousedown', function (e) {
          // If clicked inside canvas-area but no object was clicked
          if (!clickedObject && e.target.id !== 'fabric-canvas') {
              fabricCanvas.discardActiveObject();
              fabricCanvas.requestRenderAll();
              updateLayers();
          }
          clickedObject = false; // reset for next click
      });




      // Canvas events
      fabricCanvas.on("selection:created", handleSelection)
      fabricCanvas.on("selection:updated", handleSelection)
      fabricCanvas.on("selection:cleared", handleSelectionCleared)
      fabricCanvas.on("object:added", handleObjectChange)
      fabricCanvas.on("object:removed", handleObjectChange)
      fabricCanvas.on("object:modified", handleObjectChange)
      
       // while typing/editing text
      fabricCanvas.on("text:changed", (e) => {
        if (e && e.target) updateTextAlignPanel(e.target);
      });

      // when user finishes edits or resizes which could affect wrapping
      fabricCanvas.on("object:modified", (e) => {
        if (e && e.target) updateTextAlignPanel(e.target);
      });

      function showAiEditTrigger() {
  $('#ai-edit-trigger').fadeIn(120);
}

function hideAiEditTrigger() {
  clearTimeout(aiTriggerShowTimer);
  $('#ai-edit-trigger').hide();
}


function scheduleAiEditTrigger(obj) {
  clearTimeout(aiTriggerShowTimer);

  aiTriggerShowTimer = setTimeout(() => {
    if (!isCanvasTransforming && obj === fabricCanvas.getActiveObject()) {
      positionAiEditTrigger(obj);
      showAiEditTrigger();
    }
  }, 100); // ✨ polish delay
}

fabricCanvas.on('selection:created', function (e) {
  const obj = e.selected?.[0];
  if (!obj || obj.type !== 'image') {
    hideAiEditTrigger();
    return;
  }

  scheduleAiEditTrigger(obj);
});

fabricCanvas.on('selection:updated', function (e) {
  const obj = e.selected?.[0];
  if (!obj || obj.type !== 'image') {
    hideAiEditTrigger();
    return;
  }

  scheduleAiEditTrigger(obj);
});

fabricCanvas.on('selection:cleared', function () {
  hideAiEditTrigger();
});



fabricCanvas.on('mouse:down', function () {
  isCanvasTransforming = true;
  hideAiEditTrigger();
});

fabricCanvas.on('object:moving', function () {
  isCanvasTransforming = true;
  hideAiEditTrigger();
});

fabricCanvas.on('object:scaling', function () {
  isCanvasTransforming = true;
  hideAiEditTrigger();
});

fabricCanvas.on('object:rotating', function () {
  isCanvasTransforming = true;
  hideAiEditTrigger();
});

fabricCanvas.on('mouse:up', function () {
  isCanvasTransforming = false;

  const obj = fabricCanvas.getActiveObject();
  if (obj && obj.type === 'image') {
    scheduleAiEditTrigger(obj);
  }
});


      // when (re)selecting objects
      fabricCanvas.on("selection:created", handleSelectionEvent);
      fabricCanvas.on("selection:updated", handleSelectionEvent);

      // when nothing is selected
      fabricCanvas.on("selection:cleared", () => {
        const panel = document.querySelector(".text--align");
        if (panel) panel.classList.remove("_active");
      });

   
       updateSaveButtonState();
         // =========================
// SMART GUIDES (Canvas + Objects)
// =========================
const snapTolerance = 10;
let guideLines = [];

// Create 2 permanent guide lines (horizontal + vertical)
function createGuides() {
  const hLine = new fabric.Line([0, 0, CANVAS_SIZE, 0], {
    stroke: '#27aafa',
    strokeWidth: 4,
    selectable: false,
    evented: false,
    visible: false,
    excludeFromExport: true,
    isGuide: true
  });
  const vLine = new fabric.Line([0, 0, 0, CANVAS_SIZE], {
    stroke: '#27aafa',
    strokeWidth: 4,
    selectable: false,
    evented: false,
    visible: false,
    excludeFromExport: true,
    isGuide: true
  });

  guideLines = [hLine, vLine];
  fabricCanvas.add(...guideLines);
}

function hideGuides() {
  guideLines.forEach(line => line.set({ visible: false }));
}



fabricCanvas.on("object:moving", function (e) {
  const obj = e.target;
  if (!obj) return;

  hideGuides();
  obj.setCoords(); // 🔥 critical

  const center = obj.getCenterPoint();
  const bounds = obj.getBoundingRect(true); // rotated bounds
  const canvasCenterX = CANVAS_SIZE / 2;
  const canvasCenterY = CANVAS_SIZE / 2;

  let snapCenterX = null;
  let snapCenterY = null;

  // =========================
  // SNAP TO CANVAS CENTER
  // =========================
  if (Math.abs(center.x - canvasCenterX) < snapTolerance) {
    snapCenterX = canvasCenterX;
    guideLines[1].set({
      x1: canvasCenterX, y1: 0,
      x2: canvasCenterX, y2: CANVAS_SIZE,
      visible: true
    });
  }

  if (Math.abs(center.y - canvasCenterY) < snapTolerance) {
    snapCenterY = canvasCenterY;
    guideLines[0].set({
      x1: 0, y1: canvasCenterY,
      x2: CANVAS_SIZE, y2: canvasCenterY,
      visible: true
    });
  }

  // =========================
  // SNAP TO OTHER OBJECTS
  // =========================
  fabricCanvas.getObjects().forEach(other => {
    if (other === obj || guideLines.includes(other)) return;

    other.setCoords();

    const oCenter = other.getCenterPoint();
    const oBounds = other.getBoundingRect(true);

    // --- Center align ---
    if (Math.abs(center.x - oCenter.x) < snapTolerance) {
      snapCenterX = oCenter.x;
      guideLines[1].set({
        x1: oCenter.x, y1: 0,
        x2: oCenter.x, y2: CANVAS_SIZE,
        visible: true
      });
    }

    if (Math.abs(center.y - oCenter.y) < snapTolerance) {
      snapCenterY = oCenter.y;
      guideLines[0].set({
        x1: 0, y1: oCenter.y,
        x2: CANVAS_SIZE, y2: oCenter.y,
        visible: true
      });
    }

    // --- Left ---
    if (Math.abs(bounds.left - oBounds.left) < snapTolerance) {
      snapCenterX = oBounds.left + bounds.width / 2;
      guideLines[1].set({
        x1: oBounds.left, y1: 0,
        x2: oBounds.left, y2: CANVAS_SIZE,
        visible: true
      });
    }

    // --- Right ---
    if (Math.abs(bounds.left + bounds.width - (oBounds.left + oBounds.width)) < snapTolerance) {
      snapCenterX = oBounds.left + oBounds.width - bounds.width / 2;
      guideLines[1].set({
        x1: oBounds.left + oBounds.width, y1: 0,
        x2: oBounds.left + oBounds.width, y2: CANVAS_SIZE,
        visible: true
      });
    }

    // --- Top ---
    if (Math.abs(bounds.top - oBounds.top) < snapTolerance) {
      snapCenterY = oBounds.top + bounds.height / 2;
      guideLines[0].set({
        x1: 0, y1: oBounds.top,
        x2: CANVAS_SIZE, y2: oBounds.top,
        visible: true
      });
    }

    // --- Bottom ---
    if (Math.abs(bounds.top + bounds.height - (oBounds.top + oBounds.height)) < snapTolerance) {
      snapCenterY = oBounds.top + oBounds.height - bounds.height / 2;
      guideLines[0].set({
        x1: 0, y1: oBounds.top + oBounds.height,
        x2: CANVAS_SIZE, y2: oBounds.top + oBounds.height,
        visible: true
      });
    }
  });

  // =========================
  // APPLY SNAP (center based)
  // =========================
  if (snapCenterX !== null || snapCenterY !== null) {
    obj.setPositionByOrigin(
      new fabric.Point(
        snapCenterX !== null ? snapCenterX : center.x,
        snapCenterY !== null ? snapCenterY : center.y
      ),
      "center",
      "center"
    );
  }

  obj.setCoords();
  fabricCanvas.requestRenderAll();
});


// Hide after release
fabricCanvas.on("mouse:up", hideGuides);

// Listen for selection change
fabricCanvas.on("selection:created", syncBgRemoveToggle);
fabricCanvas.on("selection:updated", syncBgRemoveToggle);
fabricCanvas.on("selection:cleared", function() {
  $("#bg-remove-toggle").prop("checked", false); // reset when nothing selected
  $("#edit-image-btn span").text("Remove Background");
  $("#edit-image-btn img").attr("src",bgRemoveImage);
  $(".right-panel").removeClass("_active");
});

function syncBgRemoveToggle(e) {
  const obj = e.selected ? e.selected[0] : fabricCanvas.getActiveObject();
  if (obj && obj.type === "image") {
    $("#bg-remove-toggle").prop("checked", !!obj._bgRemoved);
     if(obj._bgRemoved){
        $("#edit-image-btn span").text("Revert")
        $("#edit-image-btn img").attr("src",bgRemoveRevert);
     }else{
       $("#edit-image-btn span").text("Remove Background")
       $("#edit-image-btn img").attr("src",bgRemoveImage);
     }
  } else {
    $("#bg-remove-toggle").prop("checked", false);
    $("#edit-image-btn span").text("Remove Background")
    $("#edit-image-btn img").attr("src",bgRemoveImage);
  }
}
// Init
createGuides();



let isPanning = false;
let lastPosX = 0;
let lastPosY = 0;

// Detect spacebar press
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    isPanning = true;
    fabricCanvas.defaultCursor = "grab";  // show grab hand
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    isPanning = false;
    fabricCanvas.defaultCursor = "default";
  }
});

// Mouse down → only start panning if spacebar is held
fabricCanvas.on("mouse:down", (opt) => {
  if (isPanning) {
    const evt = opt.e;
    this.isDragging = true;
    this.selection = false;
    lastPosX = evt.clientX;
    lastPosY = evt.clientY;
    fabricCanvas.defaultCursor = "grabbing"; // while dragging
  }
});

// Mouse move → update viewport transform
fabricCanvas.on("mouse:move", (opt) => {
  if (this.isDragging && isPanning) {
    const e = opt.e;
    const vpt = fabricCanvas.viewportTransform;
    vpt[4] += e.clientX - lastPosX;
    vpt[5] += e.clientY - lastPosY;
    fabricCanvas.requestRenderAll();
    lastPosX = e.clientX;
    lastPosY = e.clientY;
  }
});

// Mouse up → stop panning
fabricCanvas.on("mouse:up", () => {
  if (isPanning) {
    this.isDragging = false;
    fabricCanvas.selection = true;
    fabricCanvas.defaultCursor = "grab";
  }
});


$("#edit-text-btn").on("click", function(e) {
  e.preventDefault();

  if (!fabricCanvas) return;

  const active = fabricCanvas.getActiveObject();
  if (active && (active.type === "i-text" || active.type === "textbox")) {
    // Start editing mode
    active.enterEditing();

    // Select the entire text
    active.selectAll();

    // Force canvas update
    fabricCanvas.requestRenderAll();

    // Ensure the hidden textarea gets focus (mobile keyboard)
    setTimeout(() => {
      if (active.hiddenTextarea) {
        active.hiddenTextarea.focus();
        active.hiddenTextarea.select(); // also highlights the text in DOM
      }
    }, 50);
  } else {
    alert("Please select a text object first.");
  }
  $(".right-panel").removeClass("_active");
});


$(".text-fill-swatch[data-color]").click(function () {
  if ($(this).hasClass("stroke-color")) return;

  const color = $(this).data("color");
  $(".text-fill-swatch").removeClass("active");
  $(this).addClass("active");
  $("#text-color-picker").val(color);
  updateTextProperty("fill", color);
  $("#font-color-panel-btn .text-fill-swatch")
    .attr("data-color", color)
    .css("background-color", color);
  $("#selected_font_color_name").text(color);

  applyColorBasedOnActivePanel(color); 
  refreshDocumentFonts(); // ✅ keep document fonts synced 
});

      // Save initial state
      setTimeout(saveState, 100)

      console.log("Canvas setup complete")
    } catch (error) {
      console.error("Failed to initialize canvas:", error)
      alert("Failed to initialize the canvas. Please refresh the page and try again.")
    }
  }

 function updateSaveButtonState() {
  const hasObjects = fabricCanvas.getObjects().some(obj => !obj.isGuide);
  const saveBtn = document.getElementById("save-aws-btn");
  const downloadBtn = document.getElementById("export-btn");
  const rightPanel = document.querySelector(".right-panel");
  saveBtn.disabled = !hasObjects;
  downloadBtn.disabled = !hasObjects;
  rightPanel.setAttribute("data-disabled",!hasObjects);
}


 

function fitCanvasToArea() { 
  console.log("triggered");
  if (!fabricCanvas) return;

  const $canvasArea = $(".canvas-area");
  const $wrapper = $(".canvas-wrapper");

  if (!$canvasArea.length || !$wrapper.length) return;

  // Make wrapper fill maximum possible area
  $wrapper.css({
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });

  // available space inside canvas-area
  const areaRect = $canvasArea[0].getBoundingClientRect();

  // padding so canvas doesn't touch edges
  const PADDING = 24;

  const availableWidth = Math.max(0, areaRect.width - PADDING * 2);
  const availableHeight = Math.max(0, areaRect.height - PADDING * 2);

  // Use real canvas size (not CANVAS_SIZE)
  const baseW = CANVAS_WIDTH;
  const baseH = CANVAS_HEIGHT;

  // Calculate best zoom
  const scaleX = availableWidth / baseW;
  const scaleY = availableHeight / baseH;

  let scale = Math.min(scaleX, scaleY);

  // clamp zoom
  scale = Math.max(0.1, Math.min(scale, 2)); // allow up to 200%

  // Apply zoom + resize Fabric element
  fabricCanvas.setZoom(scale);
  fabricCanvas.setWidth(baseW * scale);
  fabricCanvas.setHeight(baseH * scale);

  // keep zoom global consistent with buttons
 zoom = Math.round(scale * 100);
 DEFAULT_ZOOM = zoom
  //   zoom = 100
  updateZoomDisplay();

  fabricCanvas.requestRenderAll();
}
        // Auto-fit on first load (fill canvas-area)
        setTimeout(() => {
          fitCanvasToArea();
        }, 50);

        $("body").on("click", "a[href$='products/ninja-dtf-transfer-builder'], a[href$='products/uv-dtf-stickers-decals-builder']", function(e){
            e.preventDefault();
            if($(this).attr("href").indexOf("/products/uv-dtf") > -1 && location.href.indexOf("/products/uv-dtf-stickers")  > -1 ){
              fitCanvasToArea();
            } else if($(this).attr("href").indexOf("/products/ninja-dtf-transfer-builder") > -1 && location.href.indexOf("/products/dtf-transfers")  > -1 ){
              fitCanvasToArea();
            }  
            });

        // Refit on resize (optional but recommended)
        window.addEventListener("resize", () => {
          fitCanvasToArea();
        });
 

// When dropdown changes
$("#print-size").on("change", function () {
  const value = $(this).val(); // e.g. "11x17"
  const [widthInch, heightInch] = value.split("x").map(Number);

  setCanvasSizeFromInches(widthInch, heightInch);
});

function setCanvasSizeFromInches(widthInch, heightInch) {
  // Export size (hi-res for print)
  const exportWidth = widthInch * DPI;
  const exportHeight = heightInch * DPI;

  // Scale down to preview size (maintain aspect ratio)
  const scaleFactor = PREVIEW_SIZE / Math.max(exportWidth, exportHeight);
  const previewWidth = Math.round(exportWidth * scaleFactor);
  const previewHeight = Math.round(exportHeight * scaleFactor);

  // Update globals (store both dimensions, not just max)
  CANVAS_WIDTH = previewWidth;
  CANVAS_HEIGHT = previewHeight;
  EXPORT_WIDTH = exportWidth;
  EXPORT_HEIGHT = exportHeight;

  // If you still need a multiplier, compute it consistently
  EXPORT_MULTIPLIER = exportWidth / previewWidth; // same ratio as height

  // Resize Fabric.js canvas
  fabricCanvas.setWidth(previewWidth);
  fabricCanvas.setHeight(previewHeight);

   fitCanvasToArea()

  console.log(
    `📏 Canvas set to ${widthInch}x${heightInch} inches | Preview: ${previewWidth}x${previewHeight}px | Export: ${exportWidth}x${exportHeight}px | Multiplier: ${EXPORT_MULTIPLIER}`
  );
}



function updateFontWeightDropdown(fontName) {
  const weightSelect = $("#font-weight");
  weightSelect.empty();

  const weights = googleFontMeta[fontName] || [400]; // fallback
  weights.forEach(weight => {
    const label = getWeightLabel(weight);
    weightSelect.append(`<option value="${weight}">${label} (${weight})</option>`);
  });

  // Set default to 400 if available
  if (weights.includes(400)) {
    weightSelect.val("400");
  } else {
    weightSelect.val(weights[0].toString());
  }

  // Trigger update on selected text if any
  updateTextProperty("fontWeight", weightSelect.val());
}

function getWeightLabel(weight) {
  switch (weight) { 
    case 300: return "Light";
    case 400: return "Regular";
    case 500: return "Medium";
    case 600: return "Semi Bold";
    case 700: return "Bold";
    case 800: return "Extra Bold";
    case 900: return "Black";
    default: return `Weight ${weight}`;
  }
}


 // =========================
// PROPER STROKE SYSTEM
// =========================

function initStrokeSystem() {
    console.log("Initializing stroke system...");
    
    currentStrokeStyle = "none";
  currentStrokeColor = "#000000";
  currentStrokeWidth = 1;
  currentEdgeStyle = "round";



$(".style_stroke_container input").on("click", function(){
    let val = $(this).val();
    $(".stroke-color-container, .stroke-size-container, .edge-container, .direction-container, .distance-container, .shadow-size-container").hide();
    
    // Update current stroke style
    currentStrokeStyle = val;
    
    if(val == "none"){
      // When selecting "None", apply the removal but preserve settings
      const obj = fabricCanvas.getActiveObject();
      if (obj && (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text")) {
        removeStrokeEffect(obj);
        fabricCanvas.requestRenderAll();
      }
    } else {
      $(".stroke-color-container").css({"display":"flex"});
      $(".stroke-size-container").css({"display":"block"});
      
      // When selecting any stroke style, apply it immediately
      const obj = fabricCanvas.getActiveObject();
      if (obj && (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text")) {
        applyStrokeToSelected();
      }
      
      if(val == "outline"){  
        $(".edge-container").css({"display":"flex"});           
      } else if(val == "shadow"){  
        $(".stroke-size-container, .edge-container").css({"display":"none"});
        $(".direction-container, .distance-container, .shadow-size-container").css({"display":"block"});     
      } else if(val == "raised"){ 
        $(".stroke-size-container, .direction-container, .distance-container, .shadow-size-container").css({"display":"block"});
        $(".edge-container, .stroke-color-container").css({"display":"flex"}); 
      }
    } 
    
    // Update the display name
    $("#selected_font_stroke_name").text(getStrokeStyleDisplayName(val));
});

    // Style selection
    $(".style_stroke_container input").on("change", function() {
        currentStrokeStyle = $(this).val();
        console.log("Style changed to:", currentStrokeStyle);
        updateStrokeUI();
        applyStrokeToSelected();
        $("#selected_font_stroke_name").text(getStrokeStyleDisplayName(currentStrokeStyle));
    });
    
    // Stroke color 
$(document).on("click", ".stroke-color", function() {
  const color = $(this).data("color") || "#000000";
  console.log("Stroke color changed to:", color);
  
  // Update global variable
  currentStrokeColor = color;
  
  $(".stroke-color").removeClass("active");
  $(this).addClass("active");
  
  // Apply to selected object
  const obj = fabricCanvas.getActiveObject();
  if (obj && (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text")) {
    obj.set({ stroke: color });
    fabricCanvas.requestRenderAll();
  }
  
  // Update picker and display
  $("#text-stroke-picker").val(color);
  $("#font-stroke-color-panel-btn .stroke-color")
    .attr("data-color", color)
    .css("background-color", color);
  $("#selected_font_stroke_color_name").text(color);
  
   applyColorBasedOnActivePanel(color);
});
    
    // Stroke width
  // Stroke width
$("#stroke-width").on("input", function() {
  const value = parseInt($(this).val());
  $("#stroke-width-display").val(value);
  currentStrokeWidth = value;
  
  // If we have an outline style active, apply the change immediately
  const obj = fabricCanvas.getActiveObject();
  if (obj && (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") && currentStrokeStyle !== "none") {
    obj.set({ strokeWidth: value });
    fabricCanvas.requestRenderAll();
  }
});

$("#stroke-width-display").on("change", function() {
  const value = parseInt($(this).val()) || 1;
  $("#stroke-width").val(value);
  currentStrokeWidth = value;
  
  // If we have an outline style active, apply the change immediately
  const obj = fabricCanvas.getActiveObject();
  if (obj && (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") && currentStrokeStyle !== "none") {
    obj.set({ strokeWidth: value });
    fabricCanvas.requestRenderAll();
  }
});
    
    // Edge style
    $("#edgeStyle").on("change", function() {
        currentEdgeStyle = $(this).val();
        console.log("Edge style changed to:", currentEdgeStyle);
        applyStrokeToSelected();
    });
    
    console.log("Stroke system initialized");
   //  applyColorBasedOnActivePanel(color); // ADD THIS LINE to initialize on load
}

function updateStrokeUI() {
    console.log("Updating UI for style:", currentStrokeStyle);
    
    // Hide all containers first
    $(".stroke-color-container, .stroke-size-container, .edge-container").hide();
    
    // Show relevant containers for outline
    if (currentStrokeStyle === "outline") {
        $(".stroke-color-container, .stroke-size-container, .edge-container").show();
    }
}

function updateStrokeColor(color) {
  currentStrokeColor = color;
  console.log("Stroke color updated:", color);
  
  // Update UI
  $("#font-stroke-color-panel-btn .stroke-color")
    .attr("data-color", color)
    .css("background-color", color);
  $("#selected_font_stroke_color_name").text(color);
  
  // Apply to selected object using Fabric's stroke property
  const obj = fabricCanvas.getActiveObject();
  if (obj && (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text")) {
    obj.set({ stroke: color });
    fabricCanvas.requestRenderAll();
  }
  
   applyColorBasedOnActivePanel(color);
}

function updateStrokeWidth(value) {
    currentStrokeWidth = Math.max(1, Math.min(20, value));
    console.log("Stroke width updated:", currentStrokeWidth);
    applyStrokeToSelected();
}

function getStrokeStyleDisplayName(style) {
    const names = {
        "none": "None",
        "outline": "Outline"
    };
    return names[style] || "None";
}

function applyStrokeToSelected() {
  const obj = fabricCanvas.getActiveObject();
  if (!obj || !(obj.type === "textbox" || obj.type === "i-text" || obj.type === "text")) {
    console.log("No text object selected");
    return;
  }
  
  console.log("Applying stroke style:", currentStrokeStyle);
  
  // Store current settings in object for persistence
  obj.strokeStyle = currentStrokeStyle;
  // Remove obj.strokeColor and use obj.stroke instead
  obj.strokeWidth = currentStrokeWidth;
  obj.edgeStyle = currentEdgeStyle;
  
  // Apply effects based on style
  if (currentStrokeStyle === "none") {
    removeStrokeEffect(obj);
  } else if (currentStrokeStyle === "outline") {
    applyOutlineEffect(obj);
  }
  
  fabricCanvas.requestRenderAll();
   applyColorBasedOnActivePanel(obj.stroke); // This will now work with obj.stroke
  console.log("Stroke applied successfully");
}

function removeStrokeEffect(obj) {
  // Instead of completely removing stroke properties, just set strokeWidth to 0
  // This preserves the stroke color and settings for when we re-enable outline
  obj.set({
    strokeWidth: 0,
    // Keep the stroke color stored so we can restore it later
    stroke: obj.stroke || currentStrokeColor // Preserve the stroke color
  });
  
  // Note: We're not deleting obj.originalFill anymore since we removed that logic
}

function applyOutlineEffect(obj) {
  // Make sure we have a valid stroke color
  const strokeColor = currentStrokeColor || obj.stroke || "#000000";
  
  obj.set({
    stroke: strokeColor,
    strokeWidth: currentStrokeWidth,
    strokeLineCap: currentEdgeStyle === "round" ? "round" : "square",
    strokeLineJoin: currentEdgeStyle === "round" ? "round" : "miter",
    strokeUniform: true, // Keep stroke consistent when scaling
    strokeMiterLimit: 10, // For sharp corners
    paintFirst: 'stroke'
  });
  
  console.log("Outline applied:", {
    strokeColor: strokeColor,
    strokeWidth: currentStrokeWidth,
    edge: currentEdgeStyle
  });
}

function syncStrokeFromObject(obj) {
  console.log("Syncing stroke from object:", obj);
  
  if (!obj) {
    // Reset to defaults when no object
    currentStrokeStyle = "none";
    currentStrokeColor = "#000000";
    currentStrokeWidth = 1;
    currentEdgeStyle = "round";
  } else {
    // Determine current stroke style based on strokeWidth
    if (obj.strokeWidth === 0 || !obj.strokeWidth) {
      currentStrokeStyle = "none";
    } else {
      // If we have stroke width, check what style was previously set
      currentStrokeStyle = obj.strokeStyle || "outline";
    }
    
    // Use obj.stroke for the color (it should be preserved even when strokeWidth is 0)
    currentStrokeColor = obj.stroke || "#000000";
    currentStrokeWidth = obj.strokeWidth || 1;
    currentEdgeStyle = obj.edgeStyle || "round";
  }
  
  // Update UI controls
  $(`.style_stroke_container input[value="${currentStrokeStyle}"]`).prop("checked", true);
  
  $("#stroke-width").val(currentStrokeWidth);
  $("#stroke-width-display").val(currentStrokeWidth);
  
  $("#edgeStyle").val(currentEdgeStyle);
  
  // Update color swatch
  $(".stroke-color").removeClass("active");
  $(`.stroke-color[data-color="${currentStrokeColor}"]`).addClass("active");
  
  // Update display names
  $("#selected_font_stroke_name").text(getStrokeStyleDisplayName(currentStrokeStyle));
  $("#selected_font_stroke_color_name").text(currentStrokeColor);
  $("#font-stroke-color-panel-btn .stroke-color")
    .attr("data-color", currentStrokeColor)
    .css("background-color", currentStrokeColor);
  
  // Update UI visibility based on current style
  updateStrokeUI();
  
  console.log("Stroke sync completed");
}

  // Bind UI events
  function bindEvents() {
    // Toolbar buttons
    $("#undo-btn").click(undo)
    $("#redo-btn").click(redo)
    $("#zoom-out-btn").click(() => handleZoom(-25))
    $("#zoom-in-btn").click(() => handleZoom(25))
    $("#add-text-btn,#add-text-btn-2").click(addText)
    $("#add-image-btn,#add-image-btn-2").click(() => $("#file-input").click())
    $("#layers-panel-btn").click(() => togglePanel("layers"))
    $("#canvas-panel-btn").click(() => togglePanel("canvas"))
    $("#ai-panel-btn").click(() => togglePanel("ai"));
    $("#font-color-panel-btn").click(() => togglePanel("font-color"));
    $("#font-stroke-panel-btn").click(() => togglePanel("font-stroke-color"))
    $("#see-all-colors").click(() => {
  activeColorPanel = "fill"; // Set to fill when navigating to all colors from fill panel
  togglePanel("font-color-all");
});
    $("#font-stroke-color-panel-btn").click(() => togglePanel("font-stroke-color-inner"));
   $("#see-all-stroke-colors").click(() => {
  activeColorPanel = "stroke"; // Set to stroke when navigating to all colors from stroke panel
  togglePanel("font-stroke-color-all");
});
    $("#font-panel-btn").click(() => {
       togglePanel("font");
       setTimeout(function(){
         syncFontFromCanvas()
        },300)
      });
    $("#ai-panel-btn-2").on("click", function(){
       togglePanel("ai");
       //$(".right-panel").toggleClass("_active");
    })
    $("#reset-btn").click(resetCanvas)
    $("#export-btn").click(exportCanvas);
    $("#btn-hit-duplicate2,#btn-hit-duplicate").on("click",function(){
      $("#text-duplicate").click();
    })
      $("#btn-hit-delete2,#btn-hit-delete").on("click",function(){
      $("#text-delete").click();
    })

    // File input
    $("#file-input").change(handleFileUpload)

    // Canvas options
    $(".canvas-color-swatch[data-color]").click(handleCanvasColorChange)

    $("#canvas-color-picker").on("input", function () {
      updateCanvasBackground($(this).val())
    });

    $("#export-background-toggle").change(function () {
      exportWithBackground = $(this).is(":checked")
      updateExportInfo()
    })

    // Text controls
   $("#font-family").change(function () {
  const selectedFont = $(this).val();
  updateTextProperty("fontFamily", selectedFont);
  updateFontWeightDropdown(selectedFont);
});
   $("#font-weight").change(function () {
  updateTextProperty("fontWeight", $(this).val());
});
    $("#font-size").on("input", function () {
      const value = Number.parseInt($(this).val())
      $("#font-size-input").val(value)
      updateTextProperty("fontSize", value)
    })
    $("#font-size-input").change(function () {
      const value = Number.parseInt($(this).val())
      $("#font-size").val(value)
      updateTextProperty("fontSize", value)
    })

    // Text alignment
    $("[data-align]").click(function () {
      const align = $(this).data("align")
      $("[data-align]").removeClass("active")
      $(this).addClass("active")
      updateTextProperty("textAlign", align)
    })

   
    $("#text-color-picker").on("input", function () {
      const color = $(this).val()
      $(".color-swatch").not(".stroke-color").removeClass("active")
      updateTextProperty("fill", color)
        $("#font-color-panel-btn .text-fill-swatch")
  .attr("data-color", color)
  .css("background-color", color);
$("#selected_font_color_name").text(color);
    })



        $("#text-stroke-picker").on("input", function () {
      const color = $(this).val()
      $(".color-swatch.stroke-color").removeClass("active")
      updateTextProperty("stroke", color)
       $("#font-stroke-color-panel-btn .stroke-color")
        .attr("data-color", color)
        .css("background-color", color);
    $("#selected_font_stroke_color_name").text(color);
     applyColorBasedOnActivePanel(color);
    })

    /* Stroke controls
    $("#stroke-toggle").change(function () {
      const enabled = $(this).is(":checked")
      $("#stroke-controls").toggle(enabled)
      if (enabled) {
        updateTextProperty("stroke", $("#stroke-color-picker").val())
        updateTextProperty("strokeWidth", Number.parseFloat($("#stroke-width").val()))
      } else {
        updateTextProperty("stroke", null)
        updateTextProperty("strokeWidth", 0)
      }
    })

    $(".stroke-color").click(function () {
      const color = $(this).data("color") || "#000000"
      $(".stroke-color").removeClass("active")
      $(this).addClass("active")
      $("#stroke-color-picker").val(color)
      updateTextProperty("stroke", color)
    })

    $("#stroke-color-picker").change(function () {
      const color = $(this).val()
      $(".stroke-color").removeClass("active")
      updateTextProperty("stroke", color)
    })

    $("#stroke-width").on("input", function () {
      const value = Number.parseFloat($(this).val())
      $("#stroke-width-display").val(value)
      updateTextProperty("strokeWidth", value)
    })
*/ 

 



    // Text actions
    $("#text-move-up").click(() => moveObjectUp())
    $("#text-move-down").click(() => moveObjectDown())
    $("#text-duplicate").click(() => duplicateObject())
   // $("#text-delete").click(() => deleteObject())

    // Image actions
    $("#image-move-up").click(() => moveObjectUp())
    $("#image-move-down").click(() => moveObjectDown())
    $("#image-duplicate").click(() => duplicateObject())
    //$("#image-delete").click(() => deleteObject())

    // Image filters
    $(".filter-toggle").change(function () {
		  const filterType = $(this).data("filter");
		  const enabled = $(this).is(":checked");

		  $(`#${filterType}-slider`).toggle(enabled);

		  const value = parseFloat($(`#${filterType}`).val());
		  applyImageFilter(filterType, enabled, value);
		});

    // Filter sliders
   $('.filter-slider input[type="range"]').on("input", function () {
	  const filterType = $(this).attr("id"); // "brightness", "contrast", etc.
	  const value = parseFloat($(this).val());

	  $(`#${filterType}-display`).text(value.toFixed(2));
	  applyImageFilter(filterType, true, value);
	});

    // Filter buttons
    $(".filter-btn").click(function () {
      const filterType = $(this).data("filter")
      const isActive = $(this).hasClass("active")
      $(this).toggleClass("active")
      applyImageFilter(filterType, !isActive)
    })

    $("#reset-filters").click(resetAllFilters)
  }

  // Handle canvas selection
// Handle canvas selection
function handleSelection(e) { 
  selectedObject = e.selected ? e.selected[0] : e.target
  updatePropertiesFromSelection(selectedObject)
  updateLayers()
  syncStrokeFromObject(selectedObject) // Change this line
}

function handleSelectionCleared() {
  $("#bg-remove-toggle").prop("checked", false);
  $("#edit-image-btn span").text("Remove Background");
  $("#edit-image-btn img").attr("src",bgRemoveImage);
  selectedObject = null
  showPanel(null)
  updateLayers()
  syncStrokeFromObject(null) // Change this line
}  

function handleObjectChange() {
  if (!isLoadingFromHistory) {
    setTimeout(() => {
      updateLayers()
      saveState()
      updateSaveButtonState();
       
    }, 50)
  }
}

  // Update properties panel based on selected object
  function updatePropertiesFromSelection(obj) {
    if (!obj) return

    if (obj.type === "i-text" || obj.type === "textbox") {
      // Update text properties
      $("#font-family").val(obj.fontFamily || DEFAULT_FONT_FAMILY)
      $("#font-weight").val(obj.fontWeight?.toString() || DEFAULT_FONT_WEIGHT)
      $("#font-size").val(obj.fontSize || 40)
      $("#font-size-input").val(obj.fontSize || 40)

      // Update text alignment
      $("[data-align]").removeClass("active")
      $(`[data-align="${obj.textAlign || "left"}"]`).addClass("active")

      // Update fill color
      const fillColor = obj.fill?.toString() || "#000000"
      $("#text-color-picker").val(fillColor)
      $(".color-swatch").not(".stroke-color").removeClass("active")
      $(`.color-swatch[data-color="${fillColor}"]`).not(".stroke-color").addClass("active");
      $("#font-color-panel-btn .text-fill-swatch")
  .attr("data-color", fillColor)
  .css("background-color", fillColor);
$("#selected_font_color_name").text(fillColor);

      // Update stroke
      const hasStroke = obj.strokeWidth > 0 && obj.stroke && obj.stroke !== "transparent"
      $("#stroke-toggle").prop("checked", hasStroke)
      $("#stroke-controls").toggle(hasStroke)
      if (hasStroke) {
        $("#stroke-color-picker").val(obj.stroke || "#000000")
        $("#stroke-width").val(obj.strokeWidth || 1)
        $("#stroke-width-display").val((obj.strokeWidth || 1))
      }   
      showPanel("text-edit");
      if(window.innerWidth > 768){
         showPanel("text");
      }
    } else if (obj.type === "image") {
      updateImageFiltersFromObject(obj) 
      showPanel("image-edit");
      if(window.innerWidth > 768){
         showPanel("image");
      } 
    }
  }

  // Update image filter UI from object
  function updateImageFiltersFromObject(obj) {
    const filters = obj.filters || []

    // Reset all filter states
    $(".filter-toggle").prop("checked", false)
    $(".filter-slider").hide()
    $(".filter-btn").removeClass("active")

    // Update based on existing filters
    filters.forEach((filter) => {
      switch (filter.type) {
        case "Brightness":
          $("#brightness-toggle").prop("checked", true)
          $("#brightness-slider").show()
          $("#brightness").val(filter.brightness || 0)
          $("#brightness-display").text((filter.brightness || 0).toFixed(2))
          break
        case "Contrast":
          $("#contrast-toggle").prop("checked", true)
          $("#contrast-slider").show()
          $("#contrast").val(filter.contrast || 0)
          $("#contrast-display").text((filter.contrast || 0).toFixed(2))
          break
        case "Saturation":
          $("#saturation-toggle").prop("checked", true)
          $("#saturation-slider").show()
          $("#saturation").val(filter.saturation || 0)
          $("#saturation-display").text((filter.saturation || 0).toFixed(2))
          break
        case "Blur":
          $("#blur-toggle").prop("checked", true)
          $("#blur-slider").show()
          $("#blur").val(filter.blur || 0)
          $("#blur-display").text((filter.blur || 0).toFixed(2))
          break
        case "Grayscale":
          $('.filter-btn[data-filter="grayscale"]').addClass("active")
          break
        case "Invert":
          $('.filter-btn[data-filter="invert"]').addClass("active")
          break
        case "Sepia":
          $('.filter-btn[data-filter="sepia"]').addClass("active")
          break
        case "Vintage":
          $('.filter-btn[data-filter="vintage"]').addClass("active")
          break
      }
    })
  }

  // Panel management
  function togglePanel(panelName) {
    if (activePanel === panelName) {
      showPanel(null)
    } else {
      showPanel(panelName)
    }
  }

  function showPanel(panelName) {
    activePanel = panelName

      // Track which color panel is active
  if (panelName === "font-color" || panelName === "font-color-all") {
    activeColorPanel = "fill";
  } else if (panelName === "font-stroke-color-inner" || panelName === "font-stroke-color-all") {
    activeColorPanel = "stroke";
  }

    // Update button states
    $(".toolbar .btn").removeClass("active")
    if (panelName) {
      $(`#${panelName}-panel-btn`).addClass("active")
    }

    // Show/hide panels
    $(".panel").hide()
    if (panelName) {
      $(`#${panelName}-panel`).show();
      $("#global-panel").show();
    } else {
      $(`#default-panel`).show()
    }
    if(panelName == "ai" || panelName == "text-edit"  || panelName == "image-edit" || panelName == "font"  || panelName == "font-color"   || panelName == "font-color-all"   || panelName == "font-stroke-color"   || panelName == "font-stroke-color-inner"   || panelName == "font-stroke-color-all"){
      $("#global-panel").hide();
    } 
    if(panelName == "ai" || panelName == "text-edit" || panelName == "text"  || panelName == "font" || panelName == "image"  || panelName == "image-edit"   || panelName == "font-color"   || panelName == "font-color-all"   || panelName == "font-stroke-color"   || panelName == "font-stroke-color-inner"   || panelName == "font-stroke-color-all" )
     $(".right-panel").addClass("_active")
    if(panelName == "text-edit")
       $("#panel-text-heading").text("Text")
     if(panelName == "image-edit")
       $("#panel-text-heading").text("Image")  
    if(panelName == "text")
       $("#panel-text-heading").html(`<span id="panel-text-heading-edit-text"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M10.7999 12L15.3999 7.4L13.9999 6L7.9999 12L13.9999 18L15.3999 16.6L10.7999 12Z" fill="black"/></svg> Text Style</span>`)
    if(panelName == "font")
       $("#panel-text-heading").html(`<span id="panel-text-heading-edit-text-2"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M10.7999 12L15.3999 7.4L13.9999 6L7.9999 12L13.9999 18L15.3999 16.6L10.7999 12Z" fill="black"/></svg> Font</span>`)
    if(panelName == "font-color")
       $("#panel-text-heading").html(`<span id="panel-text-heading-edit-text-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M10.7999 12L15.3999 7.4L13.9999 6L7.9999 12L13.9999 18L15.3999 16.6L10.7999 12Z" fill="black"/></svg> Color</span>`)
     if(panelName == "font-color-all")
       $("#panel-text-heading").html(`<span id="panel-text-heading-edit-text-4"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M10.7999 12L15.3999 7.4L13.9999 6L7.9999 12L13.9999 18L15.3999 16.6L10.7999 12Z" fill="black"/></svg> All Colors</span>`)
    
      if(panelName == "font-stroke-color")
       $("#panel-text-heading").html(`<span id="panel-text-heading-edit-text-5"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M10.7999 12L15.3999 7.4L13.9999 6L7.9999 12L13.9999 18L15.3999 16.6L10.7999 12Z" fill="black"/></svg> Style</span>`)
    
     if(panelName == "font-stroke-color-inner")
       $("#panel-text-heading").html(`<span id="panel-text-heading-edit-text-6"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M10.7999 12L15.3999 7.4L13.9999 6L7.9999 12L13.9999 18L15.3999 16.6L10.7999 12Z" fill="black"/></svg> Color</span>`)
    
     if(panelName == "font-stroke-color-all")
       $("#panel-text-heading").html(`<span id="panel-text-heading-edit-text-7"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M10.7999 12L15.3999 7.4L13.9999 6L7.9999 12L13.9999 18L15.3999 16.6L10.7999 12Z" fill="black"/></svg> All Color</span>`)
    

    if(panelName == "image")
       $("#panel-text-heading").html(`<span id="panel-text-heading-edit-image"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M10.7999 12L15.3999 7.4L13.9999 6L7.9999 12L13.9999 18L15.3999 16.6L10.7999 12Z" fill="black"/></svg> Upload</span>`)
     if(panelName == "ai")
       $("#panel-text-heading").text("Create with Ai") 
      
     if(panelName == "ai"){
      $(".right-panel").addClass("_full") 
     }else{
      $(".right-panel").removeClass("_full") 
     }
  }

  $("body").on("click", "#panel-text-heading span#panel-text-heading-edit-text", function(){
      showPanel("text-edit");
  });

  $("body").on("click", "#panel-text-heading span#panel-text-heading-edit-text-3, #panel-text-heading-3 span#panel-text-heading-edit-text-3, #panel-text-heading span#panel-text-heading-edit-text-2, #panel-text-heading-2 span#panel-text-heading-edit-text-2", function(){
      showPanel("text");
  });

  $("body").on("click", "#panel-text-heading-4 span#panel-text-heading-edit-text-4, #panel-text-heading span#panel-text-heading-edit-text-4", function(){
      showPanel("font-color");
  });

    $("body").on("click", "#panel-text-heading-5 span#panel-text-heading-edit-text-5, #panel-text-heading span#panel-text-heading-edit-text-5", function(){
      showPanel("text");
  });


   $("body").on("click", "#panel-text-heading-6 span#panel-text-heading-edit-text-6, #panel-text-heading span#panel-text-heading-edit-text-6", function(){
      showPanel("font-stroke-color");
  });

    $("body").on("click", "#panel-text-heading-7 span#panel-text-heading-edit-text-7, #panel-text-heading span#panel-text-heading-edit-text-7", function(){
      showPanel("font-stroke-color-inner");
  });


   $("body").on("click", "#panel-text-heading span#panel-text-heading-edit-image", function(){
      showPanel("image-edit");
  });

  // Canvas background
	function handleCanvasColorChange() {
	  const color = $(this).data("color");
	  $(".canvas-color-swatch").removeClass("active");
	  $(this).addClass("active");

	  if (color === "transparent") {
      fabricCanvas.setBackgroundColor("transparent", fabricCanvas.renderAll.bind(fabricCanvas));
		updateCanvasBackground(null); // force null for transparency
	  } else {
		updateCanvasBackground(color);
		$("#canvas-color-picker").val(color);
    fabricCanvas.setBackgroundColor(color, fabricCanvas.renderAll.bind(fabricCanvas));
	  }
	}

		function updateCanvasBackground(color) {
		  const canvasWrapper = $(".canvas-wrapper");

		  if (color === null) {
			isCanvasTransparent = true;
			fabricCanvas.setBackgroundColor(null, fabricCanvas.renderAll.bind(fabricCanvas));
			canvasWrapper.addClass("transparent-background");
		  } else {
			isCanvasTransparent = false;
			canvasBackgroundColor = color;
			fabricCanvas.setBackgroundColor(color, fabricCanvas.renderAll.bind(fabricCanvas));
			canvasWrapper.removeClass("transparent-background");
		  }

		  updateExportInfo();
		}


  function updateExportInfo() {
    let message
    if (exportWithBackground) {
      message = isCanvasTransparent
        ? "Export will include a white background"
        : `Export will include ${canvasBackgroundColor} background`
    } else {
      message = "Export will have a transparent background"
    }
    $("#export-info").text(message)
  }

  // Text property updates
  function updateTextProperty(property, value) {
    if (!selectedObject || !fabricCanvas) return
    if (selectedObject.type !== "i-text" && selectedObject.type !== "textbox") return

    selectedObject.set(property, value)
    fabricCanvas.renderAll()
  }

 function applyImageFilter(filterType, enabled, value) {
  if (!selectedObject || selectedObject.type !== "image" || !fabricCanvas) return;

  try {
    const imgObj = selectedObject;
    const FilterClass = fabric.Image.filters;

    // Keep an ordered list of filters
    const filtersList = [];

    // Helper to add filters in correct order
    function maybeAdd(type, condition, filter) {
      if (condition) filtersList.push(filter);
    }

    // Get current slider values (or default if not available)
    const brightness = parseFloat($("#brightness").val()) || 0;
    const contrast = parseFloat($("#contrast").val()) || 0;
    const saturation = parseFloat($("#saturation").val()) || 0;
    const blur = parseFloat($("#blur").val()) || 0;

    // Add filters conditionally — only if checkbox is enabled
    maybeAdd("brightness", $("#brightness-toggle").is(":checked"), new FilterClass.Brightness({ brightness }));
    maybeAdd("contrast", $("#contrast-toggle").is(":checked"), new FilterClass.Contrast({ contrast }));
    maybeAdd("saturation", $("#saturation-toggle").is(":checked"), new FilterClass.Saturation({ saturation }));
    maybeAdd("blur", $("#blur-toggle").is(":checked"), new FilterClass.Blur({ blur }));

    // Button-based filters
    if ($(".filter-btn[data-filter='grayscale']").hasClass("active")) {
      filtersList.push(new FilterClass.Grayscale());
    }
    if ($(".filter-btn[data-filter='invert']").hasClass("active")) {
      filtersList.push(new FilterClass.Invert());
    }
    if ($(".filter-btn[data-filter='sepia']").hasClass("active")) {
      filtersList.push(new FilterClass.Sepia());
    }
    if ($(".filter-btn[data-filter='vintage']").hasClass("active")) {
      filtersList.push(new FilterClass.Vintage());
    }

    // Apply filters
    imgObj.filters = filtersList;
    imgObj.applyFilters();
    fabricCanvas.renderAll();
  } catch (error) {
    console.error("Error applying image filter:", error);
  }
}





  function resetAllFilters() {
    if (!selectedObject || selectedObject.type !== "image" || !fabricCanvas) return

    try {
      const imgObj = selectedObject
      imgObj.filters = []
      imgObj.applyFilters()
      fabricCanvas.renderAll()

      // Reset UI
      $(".filter-toggle").prop("checked", false)
      $(".filter-slider").hide()
      $(".filter-btn").removeClass("active")
    } catch (error) {
      console.error("Error resetting filters:", error)
    }
  }

  // Object manipulation
  function moveObjectUp() {
    if (!selectedObject || !fabricCanvas) return
    fabricCanvas.bringForward(selectedObject)
    fabricCanvas.renderAll()
    updateLayers()
  }

  function moveObjectDown() {
    if (!selectedObject || !fabricCanvas) return
    fabricCanvas.sendBackwards(selectedObject)
    fabricCanvas.renderAll()
    updateLayers()
  }

  // =========================
// KEYBOARD ARROW MOVEMENT
// =========================
document.addEventListener("keydown", function (e) {
  if (!fabricCanvas) return;
  const active = fabricCanvas.getActiveObject();

  if (!active) return;

  let step = e.shiftKey ? 10 : 1; // Hold Shift = move 10px

  switch (e.key) {
    case "ArrowUp":
      e.preventDefault();
      if (active.type === "activeSelection") {
        active.forEachObject(obj => obj.top -= step);
      } else {
        active.top -= step;
      }
      break;

    case "ArrowDown":
      e.preventDefault();
      if (active.type === "activeSelection") {
        active.forEachObject(obj => obj.top += step);
      } else {
        active.top += step;
      }
      break;

    case "ArrowLeft":
      e.preventDefault();
      if (active.type === "activeSelection") {
        active.forEachObject(obj => obj.left -= step);
      } else {
        active.left -= step;
      }
      break;

    case "ArrowRight":
      e.preventDefault();
      if (active.type === "activeSelection") {
        active.forEachObject(obj => obj.left += step);
      } else {
        active.left += step;
      }
      break;

    default:
      return; // Ignore other keys
  }

  active.setCoords();
  fabricCanvas.requestRenderAll();
   updateLayers(); // keep your layer panel synced
});


  function duplicateObject() {
    if (!selectedObject || !fabricCanvas) return

    selectedObject.clone((cloned) => {
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
        opacity: 1,
        visible: true,
      })
      fabricCanvas.add(cloned)
      fabricCanvas.setActiveObject(cloned)
      $(".right-panel").removeClass("_active");
      fabricCanvas.renderAll()
      updateLayers()
    })
  }

 function deleteObject() {
    if (!selectedObject || !fabricCanvas) return;

    if (selectedObject.type === 'activeSelection') {
        // Remove each object in the multi-selection
        selectedObject.forEachObject(obj => fabricCanvas.remove(obj));
        fabricCanvas.discardActiveObject();
    } else {
        // Remove single object
        fabricCanvas.remove(selectedObject);
    }

    fabricCanvas.requestRenderAll();
    updateLayers();
}


function deleteActive() {
  if (!fabricCanvas) return;

  const active = fabricCanvas.getActiveObject();
  if (!active) return;

  // Don't delete while editing text
  if (active.isEditing) return;

  if (active.type === 'activeSelection') {
    // Get a stable array of selected objects, then clear selection, then remove
    const toRemove = (typeof active.getObjects === 'function')
      ? active.getObjects().slice()
      : (active._objects ? active._objects.slice() : []);

    fabricCanvas.discardActiveObject(); // clear selection wrapper first
    toRemove.forEach(obj => fabricCanvas.remove(obj));
  } else {
    // Single object (or a grouped object) — remove directly
    fabricCanvas.remove(active);
  }

  fabricCanvas.requestRenderAll();
  updateLayers();
  $(".right-panel").removeClass("_active");
}

// Hook your buttons to the new function
$("#text-delete, #image-delete").off('click').on('click', () => deleteActive());
$("#text-panel-btn").on("click", () => showPanel("text"));
$("#image-panel-btn").on("click", () => showPanel("image"));
$("#edit-image-btn").on("click", function(){
    $("#bg-remove-toggle").click();
});

if(window.innerWidth >= 768){ 
  $(".mobile_panel a").on("click", function(e){
  e.preventDefault();
  showPanel("text");
})
}

// Optional: support Delete / Backspace keys too
document.addEventListener('keydown', (e) => {
  const key = e.key;
  if (key !== 'Delete' && key !== 'Backspace') return;

  // Avoid deleting when typing in inputs or contenteditable
  const ae = document.activeElement;
  const tag = ae && ae.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (ae && ae.isContentEditable)) return;

  // Also avoid while editing Fabric IText
  const active = fabricCanvas.getActiveObject();
  if (active && active.isEditing) return;

  e.preventDefault();
  deleteActive();
});
  
 // ================================
// UNIFIED DOCUMENT COLOR MANAGEMENT
// ================================

// ================================
// CONTEXT-AWARE COLOR APPLICATION
// ================================
function applyColorBasedOnActivePanel(color) {
  if (activeColorPanel === "fill") {
    // Apply to fill property
    updateTextProperty("fill", color);
    $(".text-fill-swatch").removeClass("active");
    $(`.text-fill-swatch[data-color="${color}"]`).addClass("active");
    $("#text-color-picker").val(color);
    $("#font-color-panel-btn .text-fill-swatch")
      .attr("data-color", color)
      .css("background-color", color);
    $("#selected_font_color_name").text(color);
  } else if (activeColorPanel === "stroke") {
    // Apply to stroke property
    currentStrokeColor = color;
    updateTextProperty("stroke", color);
    $(".stroke-color").removeClass("active");
    $(`.stroke-color[data-color="${color}"]`).addClass("active");
    $("#text-stroke-picker").val(color);
    $("#font-stroke-color-panel-btn .stroke-color")
      .attr("data-color", color)
      .css("background-color", color);
    $("#selected_font_stroke_color_name").text(color);
  }
  
  updateAllDocumentColors();
}


// ================================
// UNIFIED DOCUMENT COLOR MANAGEMENT
// ================================
function updateAllDocumentColors() {
  if (!fabricCanvas) return;

  const usedColors = new Set();

  // Collect all unique colors from text objects (both fill and stroke)
  fabricCanvas.getObjects().forEach(obj => {
    if (obj.type === "textbox" || obj.type === "i-text") {
      if (obj.fill) usedColors.add(obj.fill.toLowerCase());
      if (obj.stroke) usedColors.add(obj.stroke.toLowerCase());
    }
  });

  updateDocumentColorsPanel(usedColors);
  updateDocumentStrokeColorsPanel(usedColors);
}

function updateDocumentColorsPanel(usedColors) {
  const $docColors = $("#document-colors");
  const $pickerLabel = $docColors.find(".text-fill-swatch-"); // keep color picker
  $docColors.empty().append($pickerLabel);

  usedColors.forEach(color => {
    if (!color.startsWith("rgb") && color !== "transparent") {
      const swatch = $(
        `<button class="text-fill-swatch color-swatch" data-color="${color}" style="background-color:${color};"></button>`
      );
      $docColors.append(swatch);
    }
  });

  // Re-bind click events - apply based on active panel
  $docColors.find(".text-fill-swatch").off("click").on("click", function () {
    const color = $(this).data("color");
    applyColorBasedOnActivePanel(color);
  });
}

function updateDocumentStrokeColorsPanel(usedColors) {
  const $docStrokeColors = $("#document-stroke-colors");
  const $pickerLabel = $docStrokeColors.find(".text-stroke-swatch-"); // keep color picker
  $docStrokeColors.empty().append($pickerLabel);

  usedColors.forEach(color => {
    if (!color.startsWith("rgb") && color !== "transparent") {
      const swatch = $(
        `<button class="color-swatch stroke-color" data-color="${color}" style="background-color:${color};"></button>`
      );
      $docStrokeColors.append(swatch);
    }
  });

  // Re-bind click events - apply based on active panel
  $docStrokeColors.find(".stroke-color").off("click").on("click", function () {
    const color = $(this).data("color");
    applyColorBasedOnActivePanel(color);
  });
}
  // Add elements
function addText() {
  if (!fabricCanvas) return

  const text = new fabric.IText("Click to edit text", {
    left: 100,
    top: 100,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: 40,
    fontWeight: DEFAULT_FONT_WEIGHT,
    fill: "#000000",
  })

  fabricCanvas.add(text);
  fabricCanvas.bringToFront(text);
  fabricCanvas.setActiveObject(text);
  $(".right-panel").removeClass("_active");
  fabricCanvas.renderAll()
  updateLayers()
  const obj = fabricCanvas.getActiveObject();
    if (obj && (obj.type === "textbox" || obj.type === "i-text")) {
    obj.strokeStyle = "none";
    obj.strokeWidth = 0;
    // Sync the UI to show "None" is selected
    syncStrokeFromObject(obj);
  }
  updateTextAlignPanel(obj);
  // applyColorBasedOnActivePanel(color);  
}


  // --- line counter that handles both IText and Textbox
function getLineCount(obj) {
  if (!obj || !(obj.type === "i-text" || obj.type === "textbox")) return 0;

  // Explicit newlines (works for i-text and textbox)
  const explicit = obj.text ? (obj.text.match(/\r?\n/g) || []).length + 1 : 1;

  if (obj.type === "i-text"  || obj.type === "textbox") {
    // Textbox can wrap without explicit \n; use internal computed lines if available
    const wrapped = Array.isArray(obj._textLines) ? obj._textLines.length : explicit;
    return Math.max(explicit, wrapped);
  }
  return explicit; // i-text doesn't auto-wrap; only explicit newlines count
}

function updateTextAlignPanel(obj) {
  const panel = document.querySelector(".text--align");
  if (!panel) return;

  if (obj && (obj.type === "i-text" || obj.type === "textbox")) {
    const lines = getLineCount(obj);
    if (lines >= 2) panel.classList.add("_active");
    else panel.classList.remove("_active");
  } else {
    panel.classList.remove("_active");
  }
}

// -- Hook up events --

function handleSelectionEvent(e) {
  // Prefer the active object; fall back to selection payloads
  const obj =
    (typeof fabricCanvas.getActiveObject === "function" && fabricCanvas.getActiveObject()) ||
    (e && e.selected && e.selected[0]) ||
    (e && e.target) ||
    null;

  updateTextAlignPanel(obj);
}



  async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file || !fabricCanvas) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image file.");
    e.target.value = "";
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert("File size too large. Please select < 10MB.");
    e.target.value = "";
    return;
  }

  $("#add-image-btn,#add-image-btn-2").prop("disabled", true).text("Loading...");

  try {
    // 1️⃣ Upload to S3 using presigned URL
    //const fileName = `upload-${Date.now()}-${file.name}`;
    const fileType = file.type;

    const extension = file.name.split('.').pop();
    const nameOnly = file.name.split('.')[0]
  .toLowerCase()
  .replace(/[^a-z0-9]/gi, '-')        // Replace all non-alphanumerics with dash
  .replace(/-+/g, '-')                // Collapse multiple dashes
  .replace(/^-|-$/g, ''); 

    const fileName = `${ nameOnly }____image_${ Date.now() }_${ Math.floor( Math.random() * 1000 ) }.${ extension }`;

    const presignData = await getPresignedUploadUrl(fileName, fileType);

    if (!presignData?.url || !presignData?.sourceUrl) {
      throw new Error("Failed to get presigned URL");
    }

    await fetch(presignData.url, {
      method: "PUT",
      headers: { "Content-Type": fileType },
      body: file,
    });

    // 2️⃣ Now we have Imgix-backed URL
    const imgixUrl = presignData.sourceUrl;
    console.log("✅ Uploaded to Imgix:", imgixUrl);

    // 3️⃣ Add Imgix image to Fabric.js canvas 
      fabric.Image.fromURL(imgixUrl, (fabricImg) => {
        if (!fabricImg) {
          alert("Failed to load image.");
          return;
        }

        // Scale reasonably
        const maxSize = 300;
        const scale = Math.min(
          maxSize / fabricImg.width,
          maxSize / fabricImg.height,
          1
        );

        // Apply scaling + object settings (NO positioning here)
        fabricImg.set({
          scaleX: scale,
          scaleY: scale,
          selectable: true,
          hasControls: true,
          lockUniScaling: false,
        });

        // Store metadata
        fabricImg._originalUrl = imgixUrl;
        fabricImg._bgRemoved = false;

        // 🔥 This handles centering + offset + adding to canvas
        addObjectToCanvas(fabricImg, fabricCanvas);

        $(".right-panel").removeClass("_active");

        updateLayers();
        saveState();

        console.log("Image added:", fabricImg._originalUrl);

      }, { crossOrigin: "anonymous" });


  } catch (err) {
    console.error("❌ Upload error:", err);
    alert("Upload failed: " + err.message);
  } finally {
    $("#add-image-btn,#add-image-btn-2").prop("disabled", false).html("<span><img src='https://cdn.shopify.com/s/files/1/0558/0265/8899/files/Upload_3.svg?v=17555993031' /></span> Upload Image");
    e.target.value = "";
  }
}

function showCanvasSpinner() {
  if ($("#canvas-spinner").length) return;
  $(".canvas-wrapper").append(`
    <div id="canvas-spinner" style="
      position:absolute;
      top:50%; left:50%;
      transform:translate(-50%,-50%);
      z-index:9999;
      background:rgba(255,255,255,0.6);
      border-radius:50%;
      padding:15px;
    ">
      <div style="
        border:3px solid rgba(39,170,250,0.3);
        border-top:3px solid #27aafa;
        border-radius:50%;
        width:24px; height:24px;
        animation:spin 0.6s linear infinite;
      "></div>
    </div>
  `);
}

function hideCanvasSpinner() {
  $("#canvas-spinner").remove();
}



$("#bg-remove-toggle").on("change", function() {
  const obj = fabricCanvas.getActiveObject();
  console.log("obj",obj);
  if (!obj || obj.type !== "image" || !obj._originalUrl) return;

  const removeBg = this.checked;

  // Force Imgix base URL
  let imgixBase = obj._originalUrl
    .replace(
      "ninja-services-production-ninjauploadss3bucket-zks2mguobhe4.s3.amazonaws.com",
      "ninjauploads-production.imgix.net"
    );
 imgixBase = imgixBase.split("?")[0]; 

  const newUrl = removeBg
    ? `${imgixBase}?bg-remove=true&trim=colorUnlessAlpha`
    : imgixBase;

  // Disable checkbox + show spinner
  $(this).prop("disabled", true);
  showCanvasSpinner();

  fabric.Image.fromURL(
    newUrl,
    function(newImg) {
      newImg.set({
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle,
      });

      newImg._originalUrl = imgixBase; // always clean Imgix base
      newImg._bgRemoved = removeBg;

      fabricCanvas.remove(obj);
      fabricCanvas.add(newImg);
      fabricCanvas.setActiveObject(newImg);
      fabricCanvas.requestRenderAll();

      // Sync checkbox + re-enable
      $("#bg-remove-toggle").prop("checked", removeBg).prop("disabled", false);
      hideCanvasSpinner();
    },
    { crossOrigin: "anonymous" }
  );
});


function handleZoom(delta) {
  const newZoom = Math.max(10, Math.min(200, zoom + delta)); // clamp 10–200%
  zoom = newZoom;
  updateZoomDisplay();

  if (fabricCanvas) {
    const scale = newZoom / 100;
    fabricCanvas.setZoom(scale);

    // maintain aspect ratio
    fabricCanvas.setWidth(CANVAS_WIDTH * scale);
    fabricCanvas.setHeight(CANVAS_HEIGHT * scale);
    fabricCanvas.requestRenderAll();
  }
} 

  function updateZoomDisplay() {
    $("#zoom-display").text(`${zoom}%`)
    console.log("zoom",zoom);
    if(Number(zoom) <= DEFAULT_ZOOM){
      $(".editor-container .canvas-area").css({"border":"24px solid transparent"})
      $(".floating_tools").css({"bottom":"5px"});
    }else{
     $(".editor-container .canvas-area").css({"border":"0px solid transparent"}) 
     $(".floating_tools").css({"bottom":"29px"});
    }
  }

  // History management
  function saveState() {
    if (!fabricCanvas || isLoadingFromHistory) return

    const state = JSON.stringify(fabricCanvas.toJSON())
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(state)
    history = newHistory.slice(-50) // Keep last 50 states
    historyIndex = history.length - 1

    updateHistoryButtons()
  }

  function undo() {
    if (historyIndex > 2 && fabricCanvas) {
      historyIndex--
      isLoadingFromHistory = true

      const state = history[historyIndex]
      fabricCanvas.loadFromJSON(state, () => {
        fabricCanvas.renderAll()
        updateLayers()
        updateHistoryButtons()
        isLoadingFromHistory = false
      })
    }
  }

  function redo() {
    if (historyIndex < history.length - 1 && fabricCanvas) {
      historyIndex++
      isLoadingFromHistory = true

      const state = history[historyIndex]
      fabricCanvas.loadFromJSON(state, () => {
        fabricCanvas.renderAll()
        updateLayers()
        updateHistoryButtons()
        isLoadingFromHistory = false
      })
    }
  }

  function updateHistoryButtons() {
    $("#undo-btn").prop("disabled", historyIndex <= 2)
    $("#redo-btn").prop("disabled", historyIndex >= history.length - 1)
  }

  // Layers management
  function updateLayers() {
    if (!fabricCanvas) return
   
    const objects = fabricCanvas.getObjects()
    const layersList = $("#layers-list")
 console.log("objects.length",objects.length);
    if (objects.length < 3) {
      layersList.html('<div class="no-layers">No objects on canvas</div>')
      return
    }

    let layersHtml = ""
    objects
      .slice()
      .reverse()
      .forEach((obj, index) => {
        if (obj.isGuide) return;
        const layerType =
          obj.type === "i-text" || obj.type === "textbox" ? "Text" : obj.type === "image" ? "Image" : "Object"
        const isActive = obj === selectedObject
        const visibilityIcon = obj.visible !== false ? "<img src='https://cdn.shopify.com/s/files/1/0558/0265/8899/files/layer-eye.svg' />️" : "<img src='https://cdn.shopify.com/s/files/1/0558/0265/8899/files/eye-close_1_-cropped.svg?v=1755520614' />️"

        layersHtml += `
                <div class="layer-item ${isActive ? "active" : ""}" data-object-id="${index}">
                    <button class="layer-visibility" data-object-id="${index}">${visibilityIcon}</button>
                    <div class="layer-info">
                        <div class="layer-name">${layerType} ${objects.length - index}</div>
                        <div class="layer-type">${obj.type}</div>
                    </div>
                    <div class="layer-actions">
                        <button class="layer-action" data-action="up" data-object-id="${index}"><img src="https://cdn.shopify.com/s/files/1/0558/0265/8899/files/move-up.svg" /></button>
                        <button class="layer-action" data-action="down" data-object-id="${index}"><img src="https://cdn.shopify.com/s/files/1/0558/0265/8899/files/move-down.svg" /></button>
                        <button class="layer-action" data-action="delete" data-object-id="${index}"><img src="https://cdn.shopify.com/s/files/1/0558/0265/8899/files/delete-black.svg" /></button>
                    </div>
                </div>
            `
      })

    layersList.html(layersHtml)

    // Bind layer events
    $(".layer-item").click(function () {
      const objectIndex = $(this).data("object-id")
      const obj = objects[objects.length - 1 - objectIndex]
      fabricCanvas.setActiveObject(obj)
      fabricCanvas.renderAll()
    })

    $(".layer-visibility").click(function (e) {
      e.stopPropagation()
      const objectIndex = $(this).data("object-id")
      const obj = objects[objects.length - 1 - objectIndex]
      obj.visible = !obj.visible
      fabricCanvas.renderAll()
      updateLayers()
    })

    $(".layer-action").click(function (e) {
      e.stopPropagation()
      const action = $(this).data("action")
      const objectIndex = $(this).data("object-id")
      const obj = objects[objects.length - 1 - objectIndex]

      switch (action) {
        case "up":
          fabricCanvas.bringForward(obj)
          break
        case "down":
          fabricCanvas.sendBackwards(obj)
          break
        case "delete":
          fabricCanvas.remove(obj)
          break
      }
      fabricCanvas.renderAll()
      updateLayers()
    })
  }

  // Canvas operations
  function resetCanvas() {
    if (!fabricCanvas) return
    fabricCanvas.clear()
    fabricCanvas.backgroundColor = "white"
    fabricCanvas.renderAll()
    updateLayers()

    // Reset history
    history = []
    historyIndex = -1
    setTimeout(saveState, 100)
  }

  function exportCanvas() {
    if (!fabricCanvas) return

    try {
      // Store current state
      const currentZoom = fabricCanvas.getZoom()
      const currentVpTransform = fabricCanvas.viewportTransform
      const currentBackground = fabricCanvas.backgroundColor

      // Reset for export
      fabricCanvas.setZoom(1)
      fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0])

      // Set export background
      let exportBgColor = null
      if (exportWithBackground) {
        exportBgColor = isCanvasTransparent ? "#ffffff" : canvasBackgroundColor
        fabricCanvas.setBackgroundColor(exportBgColor)
      } else {
        fabricCanvas.setBackgroundColor(null)
      }

      fabricCanvas.renderAll()

      // Export
      const dataURL = fabricCanvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: EXPORT_MULTIPLIER,
        left: 0,
        top: 0,
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
      })

      // Restore state
      fabricCanvas.setZoom(currentZoom)
      fabricCanvas.setViewportTransform(currentVpTransform)
      fabricCanvas.setBackgroundColor(currentBackground)
      fabricCanvas.renderAll()

      // Download
      if (dataURL && dataURL !== "data:,") {
        const link = document.createElement("a")
        link.download = `design-${Date.now()}.png`
        link.href = dataURL
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        alert("Export failed. Please try again.")
      }
    } catch (error) {
      console.error("Export error:", error)
      alert("Export failed. Please try again.")
    }
  }

  // Update UI state
  function updateUI() {
    updateZoomDisplay()
    updateHistoryButtons()
    updateExportInfo()
  }

  // Initialize the editor
  initEditor()
  

const apiURL = `https://hpz51rjda5.execute-api.us-east-1.amazonaws.com/production`;

async function getPresignedUploadUrl(file_name, file_type) {
  try {
    let rtn;
    await $.get(`${apiURL}/uploads/getPresignedUploadUrl?file_name=${encodeURIComponent(file_name)}&file_type=${encodeURIComponent(file_type)}`, function (res) {
      rtn = res;
    });
    return rtn;
  } catch (err) {
    console.log(`ERROR getPresignedUploadUrl`, err.message);
  }
}

// Always initialize with transparent background
fabricCanvas.setBackgroundColor("transparent", fabricCanvas.renderAll.bind(fabricCanvas));

async function exportCanvasAndUploadToS3() {
  if (!fabricCanvas || !fabricCanvas.lowerCanvasEl) {
    alert("Canvas not ready.");
    return;
  }

  const sizeValue = $("#print-size").val();
  const [widthInch, heightInch] = sizeValue.split("x").map(Number);
  const DPI = 300;


    const exportWidth = widthInch * DPI;   // px
    const exportHeight = heightInch * DPI; // px

  const activeObject = fabricCanvas.getActiveObject(); 
  // Hide controls
  fabricCanvas.discardActiveObject();
  fabricCanvas.renderAll();

  try {
    // 🔑 Ensure transparent background during export
    const prevBg = fabricCanvas.backgroundColor;
    fabricCanvas.setBackgroundColor(null, fabricCanvas.renderAll.bind(fabricCanvas));

     const dataURL = fabricCanvas.toDataURL({
        format: "png",
        quality: 1,
        left: 0,
        top: 0,
        width: fabricCanvas.getWidth(),
        height: fabricCanvas.getHeight(),
        multiplier: exportWidth / fabricCanvas.getWidth(), // scale to target width
      });

    // restore user background
    fabricCanvas.setBackgroundColor(prevBg, fabricCanvas.renderAll.bind(fabricCanvas));

    // Convert to Blob
    const blob = await (await fetch(dataURL)).blob();
    const fileName = `design-studio-${Date.now()}-${Math.floor(Math.random() * 10000)}.png`;
    const fileType = "image/png";

    // ✅ Calculate CRC using your helper
    const file_crc = await makeCRC_2(blob);

    // Get presigned URL
    const presignData = await getPresignedUploadUrl(fileName, fileType);
    if (!presignData?.url || !presignData?.sourceUrl) {
      throw new Error("Invalid presigned URL response");
    }

    // Upload to S3
    const uploadRes = await fetch(presignData.url, {
      method: "PUT",
      headers: { "Content-Type": fileType },
      body: blob,
    });

    if (!uploadRes.ok) throw new Error("Upload failed");

    const uploadedUrl = presignData.sourceUrl;
    console.log("✅ S3 Upload Success:", uploadedUrl);

    // ✅ Save metadata in DB (only if logged in)
    if (IS_CUSTOMER_LOGGED_IN) {
      try {
        const payload = [{
          variant_title: $("#print-size").val(),
          file: uploadedUrl,
          customer_id: STUDIO_CUSTOMER_ID,
          file_name: fileName,
          file_crc: file_crc,   // 👈 your CRC value
          product_id: "",
          gangsheet: false
        }];

        await $.ajax({
          url: `https://hpz51rjda5.execute-api.us-east-1.amazonaws.com/production/uploads/saveData`,
          method: "POST",
          contentType: "application/json",
          data: JSON.stringify(payload),
        });

        console.log("✅ Saved to DB via API");
      } catch (dbErr) {
        console.error("❌ DB Save Error:", dbErr);
      }
    }

    // ✅ Check if any image has bgRemoved flag
    const anyBgRemoved = fabricCanvas.getObjects().some(
      (obj) => obj.type === "image" && obj._bgRemoved === true
    );

    const anyAiImage = fabricCanvas.getObjects().some(
      (obj) => obj.type === "image" && obj._aiGenerated === true
    );

    // Build redirect URL
    let redirectUrl = `?file=${encodeURIComponent(uploadedUrl)}&_design_studio=Yes`;
    if (anyBgRemoved) redirectUrl += "&bg-removed=Yes";
    if (anyAiImage) redirectUrl += "&_ai_created=Yes";

    if (location.href.indexOf("/pages/ninja-design-studio") > -1) {
      $(".editor-container .toolbar").css({ "pointer-events": "none", "opacity": 0.6 });
      document.querySelectorAll(".design-transfer-overlay ul li a").forEach(anchor => {
        if (anchor.href.includes("?")) {
          anchor.href += "&" + redirectUrl.substring(1);
        } else {
          anchor.href += redirectUrl;
        }
      });
      document.querySelector(".design-transfer-overlay-container").style.display = "flex";
    } else {
      window.location.href = redirectUrl;
    }

  } catch (err) {
    console.error("❌ Upload Error:", err);
    alert("Upload failed: " + err.message);

    const $btn = $("#save-aws-btn");
    const $text = $btn.find(".btn-text");
    const $loader = $btn.find(".btn-loader");
    if (IS_CUSTOMER_LOGGED_IN)
      $text.text("Save and Use Design");
    else
      $text.text("Use Design");
    $loader.hide();
    $btn.prop("disabled", false);
    $("#save-aws-btn").css({ "pointer-events": "all", opacity: 1 });
  } finally {
    if (activeObject) {
      fabricCanvas.setActiveObject(activeObject);
      fabricCanvas.renderAll();
    }
  }
}
 

async function getAsByteArray_2(file) {
  return new Uint8Array(await readFile_2(file));
}
async function makeCRC_2( file ) {
  try {
    const byteArr = await getAsByteArray_2( file );
    file_crc = (CRC32.buf(byteArr)>>>0).toString(16);
    return file_crc;
  }
  catch (error) {
    console.log("Unable to calculate file crc: " + error)
  }
}
function readFile_2(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.addEventListener("loadend", (e) => resolve(e.target.result));
    reader.addEventListener("error", reject);
    reader.readAsArrayBuffer(file);
  });
}

  $("#save-aws-btn").on("click", async function () {
    const $btn = $(this);
    const $text = $btn.find(".btn-text");
    const $loader = $btn.find(".btn-loader");
    $("#save-aws-btn").css({"pointer-events":"none","opacity":0.6});
    // Show loader, disable button
    $text.text("Wait...");
    $loader.show();
    $btn.prop("disabled", true);

    try {
        await exportCanvasAndUploadToS3();
    } finally {
        // Restore button state
      //  $text.text("💾 Save");
     //   $loader.hide();
     //   $btn.prop("disabled", false);
     //   $("#save-aws-btn").css({"pointer-events":"all","opacity":1});
    }
});

 const batchSize = 3;
  const maxImages = 9;
  const brandingName = `ninjatransfers.com`;
  const host = 'https://www.rushordertees.com/design';

  if (!$('#ai_prompt_error').length) {
    $('#ai_prompt').after('<div id="ai_prompt_error" style="color:red; font-size:14px; margin-top:4px;"></div>');
  }

  $(document).on('click', '#ai_generate_image', async function () {
    const prompt = $('#ai_prompt').val().trim();
    const resultsContainer = $('#ai-generative-images-results');
    const wrapper = $('#ai-generative-images');
    const errorBox = $('#ai_prompt_error');
    const button = $('#ai_generate_image');

    errorBox.text('');
    if (!prompt) {
      errorBox.text('Please enter a prompt to generate images.');
      return;
    }

    resultsContainer.empty();
    wrapper.hide();

    button.prop('disabled', true).html('<img src="https://cdn.shopify.com/s/files/1/0558/0265/8899/files/ai-image.svg" style="height: 14px;vertical-align: middle;"> Generating...');

    try {
      let gridWrapper = $('<div class="grid"></div>');
      resultsContainer.append(gridWrapper);

      let statsPromise = fetch(`${host}/generative-stats.php?type=clipart`).then(res => res.json());
      let existingPromise = fetch(`${host}/studio/getGenerativeAiUploads.php?prompt=` + encodeURIComponent(prompt), {
        credentials: "include"
      }).then(res => res.json());

      let allResults = await Promise.allSettled([statsPromise, existingPromise]);
      let stats = allResults[0].status === 'fulfilled' ? allResults[0].value : {};
      let existingImages = allResults[1].status === 'fulfilled' ? allResults[1].value : [];

      let remainingSearches = stats.remainingRequest ? Math.ceil(stats.remainingRequest / batchSize) : Number.MAX_SAFE_INTEGER;

      if (remainingSearches > 0 && remainingSearches <= 5) {
        resultsContainer.prepend(`<p>You have ${remainingSearches} more AI searches remaining.</p>`);
      } else if (remainingSearches <= 0) {
        resultsContainer.prepend(`<p>You have no more AI searches remaining. Please try again later.</p>`);
        wrapper.show();
        return;
      }

      if (existingImages && existingImages.length > 0) {
        existingImages.forEach(image => {
          gridWrapper.append(createImageFigure(image));
        });
      }

      if (remainingSearches > 0 && existingImages.length < maxImages) {
        let newImages = await fetch(host + '/studio/postBatchGenerativeAiUpload.php', {
          method: 'POST',
          body: JSON.stringify({ prompt, batchSize, brandingName })
        }).then(res => res.json());

        if (newImages && newImages.length > 0) {
          newImages.forEach(image => {
            gridWrapper.append(createImageFigure(image));
          });
        }
      }

      wrapper.show();

      const container = document.querySelector('#ai-generative-images');
const figures = container.querySelectorAll('figure');

function updateZoomDirections() {

  const itemsPerRow = 2;
  const totalItems = figures.length;
  const totalRows = Math.ceil(totalItems / itemsPerRow);

  figures.forEach((fig, index) => {

    const col = index % itemsPerRow; // 0 = left, 1 = right
    const row = Math.floor(index / itemsPerRow);

    let originX = col === 0 ? '0%' : '100%'; // left expands right, right expands left
    let originY = '50%';

    // Top row
    if (row === 0) {
      originY = '0%';
    }
    // Bottom row
    else if (row === totalRows - 1) {
      originY = '100%';
    }
    // Middle rows
    else {
      originY = '50%';
    }

    fig.dataset.origin = `${originX} ${originY}`;
  });
}

updateZoomDirections();
if(window.innerWidth > 768){
figures.forEach(fig => {

  fig.addEventListener('mouseenter', () => {
    fig.classList.add('zooming');
    fig.style.transformOrigin = fig.dataset.origin;
    fig.style.transform = 'scale(1.6)';
  });

  fig.addEventListener('mouseleave', () => {
    fig.classList.remove('zooming');
    fig.style.transform = 'scale(1)';
  });

});

}

    } catch (err) {
      console.error('Error generating images', err);
      resultsContainer.append('<p>Error generating images. Please try again.</p>');
      wrapper.show();
    } finally {
      button.prop('disabled', false).html('<img src="https://cdn.shopify.com/s/files/1/0558/0265/8899/files/ai-image.svg" style="height: 14px;vertical-align: middle;"> Generate');
    }
  });

  // Helper to render images
  function createImageFigure(image) {
    const img = document.createElement('img');
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption');

    img.src = image.thumbnailUrl || image.url;
    caption.textContent = 'Use this image';

    figure.dataset.fileName = image.fileName || `ai-${Date.now()}.png`;
    figure.dataset.url = image.url;

    figure.appendChild(img);
    figure.appendChild(caption);

    // Handle click → upload to S3 + show on Fabric.js canvas
    figure.addEventListener('click', async () => {
          if (figure.classList.contains('loading')) return;

          figure.classList.add('loading');
          caption.textContent = 'Loading...';

          try {
            const imageUrl = figure.dataset.url;

            // 1. Fetch blob from AI CDN
            const blob = await fetch(imageUrl).then(res => res.blob());
            const fileName = `ai-image-${Date.now()}-${Math.floor(Math.random()*10000)}.png`;
            const fileType = blob.type || "image/png";

            // 2. Get presigned URL
            const presignData = await getPresignedUploadUrl(fileName, fileType);
            if (!presignData?.url || !presignData?.sourceUrl) {
              throw new Error("Invalid presigned URL response");
            }

            // 3. Upload to S3
            const uploadRes = await fetch(presignData.url, {
              method: "PUT",
              headers: { "Content-Type": fileType },
              body: blob,
            });
            if (!uploadRes.ok) throw new Error("Upload failed");

            const uploadedUrl = presignData.sourceUrl;
            console.log("✅ Uploaded AI image to S3:", uploadedUrl);

            // 4. Add to Fabric.js
            // 4. Add to Fabric.js
            fabric.Image.fromURL(uploadedUrl, (fabricImg) => {

              if (!fabricImg) {
                caption.textContent = "Failed";
                return;
              }

              // Scale properly (same logic as normal upload)
              const maxSize = 300;
              const scale = Math.min(
                maxSize / fabricImg.width,
                maxSize / fabricImg.height,
                1
              );

              fabricImg.set({
                scaleX: scale,
                scaleY: scale,
                selectable: true,
                hasControls: true,
              });

              // Metadata
              fabricImg._originalUrl = uploadedUrl;
              fabricImg._bgRemoved = false;
              fabricImg._aiGenerated = true;

              // 🔥 This handles centering + offset
              addObjectToCanvas(fabricImg, fabricCanvas);

            }, { crossOrigin: "anonymous" });


            caption.textContent = "Added!";
             if (window.matchMedia("(max-width: 767px)").matches) {
    showPanel("image-edit");
  }
          } catch (err) {
            console.error("❌ Error adding AI image:", err);
            caption.textContent = "Failed, try again";
          } finally {
            figure.classList.remove('loading');
          }
        });


    return figure;
  }
    

});

 $("#close-btn-2").on("click", function(){
    $(".design-transfer-overlay-container").hide(); 
    const $btn = $("#save-aws-btn");
    const $text = $btn.find(".btn-text");
    const $loader = $btn.find(".btn-loader");
    $btn.css({"pointer-events":"all","opacity":1});
    if(IS_CUSTOMER_LOGGED_IN)
        $text.text("Save and Use Design");
      else  
        $text.text("Use Design");
    $loader.hide();
    $btn.prop("disabled", false);
    $(".editor-container .toolbar").css({"pointer-events":"all","opacity":1});
 });

 document.addEventListener("click", function(event) {
  const overlay = document.querySelector(".design-transfer-overlay");
  const overlayContainer = document.querySelector(".design-transfer-overlay-container");

  // if overlayContainer is not visible, do nothing
  if (!overlayContainer || overlayContainer.style.display === "none") return;

  // check if the click is outside the overlay
  if (overlay && !overlay.contains(event.target)) {
    overlayContainer.style.display = "none";
    if($("#export-btn").prop("disabled") == false){
      const $btn = $("#save-aws-btn");
      const $text = $btn.find(".btn-text");
      const $loader = $btn.find(".btn-loader");
      $btn.css({"pointer-events":"all","opacity":1});
      if(IS_CUSTOMER_LOGGED_IN)
        $text.text("Save and Use Design");
      else  
        $text.text("Use Design");
      $loader.hide();
      $btn.prop("disabled", false);
      $(".editor-container .toolbar").css({"pointer-events":"all","opacity":1});
    }
  }
});

document.addEventListener("click", function(event) {
  const overlay = document.querySelector(".design-transfer-overlay-2");
  const overlayContainer = document.querySelector(".design-transfer-overlay-container-2");

  if (!overlayContainer || overlayContainer.style.display === "none") return;

  // Don't close if clicking inside overlay OR on the trigger
  if (
    (overlay && overlay.contains(event.target)) ||
    event.target.closest(".ai_prompt_guide")
  ) {
    return;
  }

  overlayContainer.style.display = "none";
});

 
$(".ai_prompt_guide").on("click", function(e){
  e.preventDefault();
  e.stopPropagation(); // prevent document click handler from firing
  $(".design-transfer-overlay-container-2").css({"display":"flex"});
})


document.getElementById("ai_prompt").addEventListener("keydown", function(event) {
  // Check if Enter is pressed without Shift (so Shift+Enter still makes a new line)
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // prevent new line
    document.getElementById("ai_generate_image").click(); // trigger button click
  }
});

// Show overlay helper
function showExitOverlay() {   
  $(".customTabelPopup__overlay-exit-studio").css({ display: "grid" });
}

// --- Logo click ---
$(".studio-logo").on("click", function (e) {
  if ($("#save-aws-btn").prop("disabled") == false) {
    e.preventDefault();
    showExitOverlay();
  }
});

if(window.innerWidth < 768){
$(".mobile_panel a").on("click", function(e){
  e.preventDefault();
  $(".right-panel").removeClass("_active");
})
} 
// --- Tab close / reload ---
window.addEventListener("beforeunload", function (e) {
  if ($("#save-aws-btn").prop("disabled") == false) {
    e.preventDefault();
    e.returnValue = ""; // required for Chrome
    showExitOverlay();
  }
});

// --- Browser back button ---
history.pushState(null, "", window.location.href);
window.addEventListener("popstate", function (e) {
  if ($("#save-aws-btn").prop("disabled") == false) {
    showExitOverlay();
    // prevent actual back navigation
    history.pushState(null, "", window.location.href);
  }
});

 $(".nj-popup").on("click", function(e){
  if($(this).hasClass("customTabelPopup__overlay-editor")){ 
  if (e.target !== this)
    return;
   
  $("body").removeAttr("style");
  document.querySelector('body').classList.remove("lock-page");
  document.querySelector('body').classList.remove("hide-chat");
  }
});

var CRC32;
(function (factory) {
	/*jshint ignore:start */
	/*eslint-disable */
	if(typeof DO_NOT_EXPORT_CRC === 'undefined') {
		if('object' === typeof exports) {
			factory(exports);
		} else if ('function' === typeof define && define.amd) {
			define(function () {
				var module = {};
				factory(module);
				return module;
			});
		} else {
			factory(CRC32 = {});
		}
	} else {
		factory(CRC32 = {});
	}
	/*eslint-enable */
	/*jshint ignore:end */
}(function(CRC32) {
  CRC32.version = '1.2.3';
  /*global Int32Array */
  function signed_crc_table() {
    var c = 0, table = new Array(256);

    for(var n =0; n != 256; ++n){
      c = n;
      c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
      c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
      c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
      c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
      c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
      c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
      c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
      c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
      table[n] = c;
    }

    return typeof Int32Array !== 'undefined' ? new Int32Array(table) : table;
  }

  var T0 = signed_crc_table();
  function slice_by_16_tables(T) {
    var c = 0, v = 0, n = 0, table = typeof Int32Array !== 'undefined' ? new Int32Array(4096) : new Array(4096) ;

    for(n = 0; n != 256; ++n) table[n] = T[n];
    for(n = 0; n != 256; ++n) {
      v = T[n];
      for(c = 256 + n; c < 4096; c += 256) v = table[c] = (v >>> 8) ^ T[v & 0xFF];
    }
    var out = [];
    for(n = 1; n != 16; ++n) out[n - 1] = typeof Int32Array !== 'undefined' ? table.subarray(n * 256, n * 256 + 256) : table.slice(n * 256, n * 256 + 256);
    return out;
  }
  var TT = slice_by_16_tables(T0);
  var T1 = TT[0],  T2 = TT[1],  T3 = TT[2],  T4 = TT[3],  T5 = TT[4];
  var T6 = TT[5],  T7 = TT[6],  T8 = TT[7],  T9 = TT[8],  Ta = TT[9];
  var Tb = TT[10], Tc = TT[11], Td = TT[12], Te = TT[13], Tf = TT[14];
  function crc32_bstr(bstr, seed) {
    var C = seed ^ -1;
    for(var i = 0, L = bstr.length; i < L;) C = (C>>>8) ^ T0[(C^bstr.charCodeAt(i++))&0xFF];
    return ~C;
  }

  function crc32_buf(B, seed) {
    var C = seed ^ -1, L = B.length - 15, i = 0;
    for(; i < L;) C =
      Tf[B[i++] ^ (C & 255)] ^
      Te[B[i++] ^ ((C >> 8) & 255)] ^
      Td[B[i++] ^ ((C >> 16) & 255)] ^
      Tc[B[i++] ^ (C >>> 24)] ^
      Tb[B[i++]] ^ Ta[B[i++]] ^ T9[B[i++]] ^ T8[B[i++]] ^
      T7[B[i++]] ^ T6[B[i++]] ^ T5[B[i++]] ^ T4[B[i++]] ^
      T3[B[i++]] ^ T2[B[i++]] ^ T1[B[i++]] ^ T0[B[i++]];
    L += 15;
    while(i < L) C = (C>>>8) ^ T0[(C^B[i++])&0xFF];
    return ~C;
  }

  function crc32_str(str, seed) {
    var C = seed ^ -1;
    for(var i = 0, L = str.length, c = 0, d = 0; i < L;) {
      c = str.charCodeAt(i++);
      if(c < 0x80) {
        C = (C>>>8) ^ T0[(C^c)&0xFF];
      } else if(c < 0x800) {
        C = (C>>>8) ^ T0[(C ^ (192|((c>>6)&31)))&0xFF];
        C = (C>>>8) ^ T0[(C ^ (128|(c&63)))&0xFF];
      } else if(c >= 0xD800 && c < 0xE000) {
        c = (c&1023)+64; d = str.charCodeAt(i++)&1023;
        C = (C>>>8) ^ T0[(C ^ (240|((c>>8)&7)))&0xFF];
        C = (C>>>8) ^ T0[(C ^ (128|((c>>2)&63)))&0xFF];
        C = (C>>>8) ^ T0[(C ^ (128|((d>>6)&15)|((c&3)<<4)))&0xFF];
        C = (C>>>8) ^ T0[(C ^ (128|(d&63)))&0xFF];
      } else {
        C = (C>>>8) ^ T0[(C ^ (224|((c>>12)&15)))&0xFF];
        C = (C>>>8) ^ T0[(C ^ (128|((c>>6)&63)))&0xFF];
        C = (C>>>8) ^ T0[(C ^ (128|(c&63)))&0xFF];
      }
    }
    return ~C;
  }
  CRC32.table = T0;
  // $FlowIgnore
  CRC32.bstr = crc32_bstr;
  // $FlowIgnore
  CRC32.buf = crc32_buf;
  // $FlowIgnore
  CRC32.str = crc32_str;
}));
