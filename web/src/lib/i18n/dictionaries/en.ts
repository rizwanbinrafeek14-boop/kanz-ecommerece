const en = {
  brand: { name: "KANZ CORNER EST.", tagline: "Providing superior metal solutions for industrial excellence." },
  common: {
    search: "Search", loading: "Loading…", save: "Save", cancel: "Cancel", back: "Back", next: "Next", submit: "Submit",
    view: "View", viewAll: "View all", remove: "Remove", add: "Add", yes: "Yes", no: "No", close: "Close", required: "Required",
    inStock: "In stock", outOfStock: "Out of stock", lowStock: "Low stock", onRequest: "Availability on request",
    sar: "SAR", exVat: "ex. VAT", incVat: "inc. VAT", vat: "VAT", subtotal: "Subtotal", total: "Total", quantity: "Quantity",
    unit: "Unit", sku: "SKU", brand: "Brand", category: "Category", price: "Price", language: "العربية", error: "Something went wrong. Please try again.",
    noResults: "No results found.", page: "Page", of: "of", home: "Home", all: "All", sortBy: "Sort by",
  },
  nav: {
    products: "Products", categories: "All categories", rfq: "Request a Quote", about: "About Us", contact: "Contact",
    account: "Account", signIn: "Sign in", signOut: "Sign out", register: "Create account", cart: "Cart", myOrders: "My orders", myQuotes: "My quotations",
    profile: "Profile", whatsapp: "WhatsApp", quote: "Quote",
  },
  search: { placeholder: "Search pipes, flanges, valves, grades, standards…", suggestions: "Suggestions", viewAllResults: "View all results" },
  home: {
    shopByCategory: "Shop by category", featured: "Featured products", newArrivals: "New arrivals", bestSellers: "Best sellers",
    specialOffers: "Special offers", brands: "Brands we supply", whyUs: "Why KANZ CORNER", rfqTitle: "Need a quotation for a project?",
    rfqText: "Send us your bill of quantities — pipes, fittings, flanges, valves and more — and our team will respond with a priced quotation.",
    rfqCta: "Start a bulk RFQ", emptyCatalogue: "Our online catalogue is being prepared. Request a quotation and our team will assist you directly.",
    heroTitle: "Industrial pipes, fittings, valves & flanges", heroSub: "Carbon steel, stainless steel and duplex — supplied from Al-Khobar to the Kingdom's industries.",
    heroCta: "Browse products", heroCta2: "Request a quote",
    why: [
      { t: "Technical guidance", d: "Experienced staff help with product selection and specifications." },
      { t: "Certified sources", d: "Products sourced from internationally certified manufacturers (documentation on request)." },
      { t: "Bulk & project supply", d: "Multi-line quotations for contractors, engineers and procurement teams." },
      { t: "Responsive service", d: "Fast answers by phone, WhatsApp and email." },
    ],
  },
  filters: {
    title: "Filters", clear: "Clear all", size: "Size", material: "Material", grade: "Grade", schedule: "Schedule", pressure_class: "Pressure class",
    standard: "Standard", brand: "Brand", availability: "Availability", inStockOnly: "In stock only", quoteOnly: "Quote only", priced: "Priced / buy online",
    results: "products", sort: { relevance: "Newest", nameAsc: "Name A–Z", priceLow: "Price: low to high", priceHigh: "Price: high to low", popular: "Most viewed" },
  },
  product: {
    addToCart: "Add to cart", addToQuote: "Add to quote", requestQuote: "Request a quote", added: "Added", specs: "Technical specifications", description: "Description",
    documents: "Documents", datasheet: "Datasheet (PDF)", mtc: "Material test certificate", related: "Related products", alternatives: "Alternative products",
    variants: "Available sizes & grades", selectVariant: "Select an option", priceOnRequest: "Price on request", whatsappInquiry: "Inquire on WhatsApp",
    productFamily: "Product range", familyNote: "Prices and availability for this range are provided by quotation.", minOrder: "Minimum order", offer: "Offer", new: "New",
    shareWhatsapp: "Hi KANZ CORNER, I would like to inquire about:",
  },
  cart: {
    title: "Shopping cart", empty: "Your cart is empty.", continue: "Continue shopping", checkout: "Proceed to checkout", update: "Update",
    quoteList: "Quotation list", quoteEmpty: "Your quotation list is empty.", quoteNote: "Add products here and send them to us as one RFQ.", sendRfq: "Send as RFQ",
    cartNote: "Prices exclude VAT; VAT is added at checkout.", freight: "Freight / delivery charges for bulk or heavy orders are quoted separately.",
  },
  rfq: {
    title: "Request for Quotation", intro: "List the items you need. Our team will review and reply with pricing, lead time and validity.",
    contact: "Contact details", name: "Full name", email: "Email", phone: "Phone / WhatsApp", company: "Company", vatNumber: "VAT number (optional)", city: "Delivery city",
    requiredBy: "Required by", notes: "Additional notes", items: "Line items", description: "Item description", specification: "Size / grade / schedule / standard",
    addLine: "Add line", bulkPaste: "Paste lines from Excel", bulkHint: "One item per line: description, specification, quantity (tab- or comma-separated)", import: "Import lines",
    submit: "Submit RFQ", success: "Your request has been received", ref: "Your reference", successText: "We will review it and respond by email. Keep this reference for follow-up.",
    needItem: "Add at least one item.", viewQuote: "View quotation",
  },
  checkout: {
    title: "Checkout", signInFirst: "Please sign in or create an account to place an order.", delivery: "Delivery method", deliver: "Deliver to address", pickup: "Pickup from our office",
    address: "Delivery address", recipient: "Recipient", line1: "Address line 1", line2: "Address line 2", region: "Region", postal: "Postal code", payment: "Payment method",
    bankTransfer: "Bank transfer (details sent after order)", cod: "Cash on delivery", onlineSoon: "Card / mada / Apple Pay — coming soon", place: "Place order",
    success: "Order placed", orderNo: "Order number", notes: "Order notes",
  },
  account: {
    login: "Sign in", register: "Create account", email: "Email", password: "Password", fullName: "Full name", company: "Company (optional)", phone: "Phone",
    noAccount: "No account yet?", haveAccount: "Already have an account?", checkEmail: "Check your email to confirm your account, then sign in.",
    orders: "Orders", quotations: "Quotations", status: "Status", date: "Date", details: "Details", invoice: "Invoice", noOrders: "You have no orders yet.", noQuotes: "You have no quotations yet.",
    forgot: "Forgot password?", saved: "Saved", cr: "Commercial registration (CR)", vatNo: "VAT number",
  },
  footer: {
    company: "Company", products: "Products", support: "Support", legal: "Legal", rights: "All rights reserved.", address: "Address", hours: "",
    zatcaNote: "",
  },
  status: {
    pending: "Pending", confirmed: "Confirmed", processing: "Processing", ready_for_pickup: "Ready for pickup", shipped: "Shipped", delivered: "Delivered",
    completed: "Completed", cancelled: "Cancelled", refunded: "Refunded", submitted: "Submitted", under_review: "Under review", quoted: "Quoted", accepted: "Accepted",
    rejected: "Rejected", expired: "Expired", converted: "Converted to order", unpaid: "Unpaid", paid: "Paid", partially_paid: "Partially paid", failed: "Failed",
  },
  static: {
    aboutTitle: "About KANZ CORNER EST.", contactTitle: "Contact us", privacy: "Privacy Policy", terms: "Terms & Conditions", notFound: "Page not found",
    notFoundText: "The page you are looking for does not exist or has moved.",
  },
};
export type Dictionary = typeof en;
export default en;
