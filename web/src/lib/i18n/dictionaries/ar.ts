import type { Dictionary } from "./en";

const ar: Dictionary = {
  brand: { name: "مؤسسة كنز كورنر", tagline: "حلول معدنية متفوقة للتميز الصناعي." },
  common: {
    search: "بحث", loading: "جارٍ التحميل…", save: "حفظ", cancel: "إلغاء", back: "رجوع", next: "التالي", submit: "إرسال",
    view: "عرض", viewAll: "عرض الكل", remove: "حذف", add: "إضافة", yes: "نعم", no: "لا", close: "إغلاق", required: "مطلوب",
    inStock: "متوفر", outOfStock: "غير متوفر", lowStock: "كمية محدودة", onRequest: "التوفر عند الطلب",
    sar: "ر.س", exVat: "بدون الضريبة", incVat: "شامل الضريبة", vat: "ضريبة القيمة المضافة", subtotal: "المجموع الفرعي", total: "الإجمالي", quantity: "الكمية",
    unit: "الوحدة", sku: "رمز المنتج", brand: "العلامة التجارية", category: "الفئة", price: "السعر", language: "English", error: "حدث خطأ. يرجى المحاولة مرة أخرى.",
    noResults: "لا توجد نتائج.", page: "صفحة", of: "من", home: "الرئيسية", all: "الكل", sortBy: "ترتيب حسب",
  },
  nav: {
    products: "المنتجات", categories: "جميع الفئات", rfq: "اطلب عرض سعر", about: "من نحن", contact: "اتصل بنا",
    account: "الحساب", signIn: "تسجيل الدخول", signOut: "تسجيل الخروج", register: "إنشاء حساب", cart: "السلة", myOrders: "طلباتي", myQuotes: "عروض الأسعار",
    profile: "الملف الشخصي", whatsapp: "واتساب", quote: "عرض سعر",
  },
  search: { placeholder: "ابحث عن أنابيب، فلنجات، صمامات، درجات، معايير…", suggestions: "اقتراحات", viewAllResults: "عرض كل النتائج" },
  home: {
    shopByCategory: "تسوق حسب الفئة", featured: "منتجات مميزة", newArrivals: "وصل حديثاً", bestSellers: "الأكثر مبيعاً",
    specialOffers: "عروض خاصة", brands: "العلامات التجارية التي نوردها", whyUs: "لماذا كنز كورنر", rfqTitle: "تحتاج عرض سعر لمشروع؟",
    rfqText: "أرسل لنا جدول الكميات — أنابيب ووصلات وفلنجات وصمامات وغيرها — وسيرد فريقنا بعرض سعر مفصل.",
    rfqCta: "ابدأ طلب عرض سعر كمي", emptyCatalogue: "يجري تجهيز الكتالوج الإلكتروني. اطلب عرض سعر وسيساعدك فريقنا مباشرة.",
    heroTitle: "أنابيب ووصلات وصمامات وفلنجات صناعية", heroSub: "صلب كربوني وستانلس ستيل ودوبلكس — نوردها من الخبر إلى صناعات المملكة.",
    heroCta: "تصفح المنتجات", heroCta2: "اطلب عرض سعر",
    why: [
      { t: "إرشاد فني", d: "فريق ذو خبرة يساعد في اختيار المنتج والمواصفات." },
      { t: "مصادر معتمدة", d: "منتجات من مصنّعين معتمدين دولياً (الوثائق عند الطلب)." },
      { t: "توريد المشاريع والكميات", d: "عروض أسعار متعددة البنود للمقاولين والمهندسين وفرق المشتريات." },
      { t: "خدمة سريعة", d: "ردود سريعة عبر الهاتف وواتساب والبريد الإلكتروني." },
    ],
  },
  filters: {
    title: "التصفية", clear: "مسح الكل", size: "المقاس", material: "المادة", grade: "الدرجة", schedule: "السماكة (Schedule)", pressure_class: "فئة الضغط",
    standard: "المعيار", brand: "العلامة التجارية", availability: "التوفر", inStockOnly: "المتوفر فقط", quoteOnly: "بعرض سعر", priced: "بسعر / شراء إلكتروني",
    results: "منتج", sort: { relevance: "الأحدث", nameAsc: "الاسم أ–ي", priceLow: "السعر: من الأقل", priceHigh: "السعر: من الأعلى", popular: "الأكثر مشاهدة" },
  },
  product: {
    addToCart: "أضف إلى السلة", addToQuote: "أضف إلى عرض السعر", requestQuote: "اطلب عرض سعر", added: "تمت الإضافة", specs: "المواصفات الفنية", description: "الوصف",
    documents: "المستندات", datasheet: "الورقة الفنية (PDF)", mtc: "شهادة اختبار المواد", related: "منتجات ذات صلة", alternatives: "منتجات بديلة",
    variants: "المقاسات والدرجات المتاحة", selectVariant: "اختر خياراً", priceOnRequest: "السعر عند الطلب", whatsappInquiry: "استفسر عبر واتساب",
    productFamily: "مجموعة المنتج", familyNote: "الأسعار والتوفر لهذه المجموعة تُقدَّم بعرض سعر.", minOrder: "الحد الأدنى للطلب", offer: "عرض", new: "جديد",
    shareWhatsapp: "مرحباً كنز كورنر، أود الاستفسار عن:",
  },
  cart: {
    title: "سلة التسوق", empty: "سلتك فارغة.", continue: "متابعة التسوق", checkout: "إتمام الطلب", update: "تحديث",
    quoteList: "قائمة عرض السعر", quoteEmpty: "قائمة عرض السعر فارغة.", quoteNote: "أضف المنتجات هنا وأرسلها إلينا كطلب عرض سعر واحد.", sendRfq: "إرسال كطلب عرض سعر",
    cartNote: "الأسعار غير شاملة الضريبة؛ تُضاف الضريبة عند إتمام الطلب.", freight: "تكاليف الشحن للطلبات الكبيرة أو الثقيلة تُحدَّد بعرض منفصل.",
  },
  rfq: {
    title: "طلب عرض سعر", intro: "اذكر البنود المطلوبة. سيراجع فريقنا الطلب ويرد بالأسعار ومدة التوريد وصلاحية العرض.",
    contact: "بيانات التواصل", name: "الاسم الكامل", email: "البريد الإلكتروني", phone: "الهاتف / واتساب", company: "الشركة", vatNumber: "الرقم الضريبي (اختياري)", city: "مدينة التسليم",
    requiredBy: "مطلوب بتاريخ", notes: "ملاحظات إضافية", items: "البنود", description: "وصف البند", specification: "المقاس / الدرجة / السماكة / المعيار",
    addLine: "إضافة بند", bulkPaste: "لصق بنود من إكسل", bulkHint: "بند في كل سطر: الوصف، المواصفات، الكمية (مفصولة بمسافة جدولة أو فاصلة)", import: "استيراد البنود",
    submit: "إرسال الطلب", success: "تم استلام طلبك", ref: "رقمك المرجعي", successText: "سنراجع الطلب ونرد عبر البريد الإلكتروني. احتفظ بهذا الرقم للمتابعة.",
    needItem: "أضف بنداً واحداً على الأقل.", viewQuote: "عرض عرض السعر",
  },
  checkout: {
    title: "إتمام الطلب", signInFirst: "يرجى تسجيل الدخول أو إنشاء حساب لإتمام الطلب.", delivery: "طريقة الاستلام", deliver: "التوصيل إلى العنوان", pickup: "الاستلام من مكتبنا",
    address: "عنوان التوصيل", recipient: "المستلم", line1: "العنوان - السطر 1", line2: "العنوان - السطر 2", region: "المنطقة", postal: "الرمز البريدي", payment: "طريقة الدفع",
    bankTransfer: "تحويل بنكي (تُرسل التفاصيل بعد الطلب)", cod: "الدفع عند الاستلام", onlineSoon: "بطاقة / مدى / Apple Pay — قريباً", place: "تأكيد الطلب",
    success: "تم تقديم الطلب", orderNo: "رقم الطلب", notes: "ملاحظات الطلب",
  },
  account: {
    login: "تسجيل الدخول", register: "إنشاء حساب", email: "البريد الإلكتروني", password: "كلمة المرور", fullName: "الاسم الكامل", company: "الشركة (اختياري)", phone: "الهاتف",
    noAccount: "ليس لديك حساب؟", haveAccount: "لديك حساب بالفعل؟", checkEmail: "تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.",
    orders: "الطلبات", quotations: "عروض الأسعار", status: "الحالة", date: "التاريخ", details: "التفاصيل", invoice: "الفاتورة", noOrders: "لا توجد طلبات بعد.", noQuotes: "لا توجد عروض أسعار بعد.",
    forgot: "نسيت كلمة المرور؟", saved: "تم الحفظ", cr: "السجل التجاري", vatNo: "الرقم الضريبي",
  },
  footer: { company: "الشركة", products: "المنتجات", support: "الدعم", legal: "قانوني", rights: "جميع الحقوق محفوظة.", address: "العنوان", hours: "", zatcaNote: "" },
  status: {
    pending: "قيد الانتظار", confirmed: "مؤكد", processing: "قيد التجهيز", ready_for_pickup: "جاهز للاستلام", shipped: "تم الشحن", delivered: "تم التسليم",
    completed: "مكتمل", cancelled: "ملغي", refunded: "مسترد", submitted: "مُرسل", under_review: "قيد المراجعة", quoted: "تم التسعير", accepted: "مقبول",
    rejected: "مرفوض", expired: "منتهي", converted: "حُوّل إلى طلب", unpaid: "غير مدفوع", paid: "مدفوع", partially_paid: "مدفوع جزئياً", failed: "فشل",
  },
  static: {
    aboutTitle: "عن مؤسسة كنز كورنر", contactTitle: "اتصل بنا", privacy: "سياسة الخصوصية", terms: "الشروط والأحكام", notFound: "الصفحة غير موجودة",
    notFoundText: "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
  },
};
export default ar;
