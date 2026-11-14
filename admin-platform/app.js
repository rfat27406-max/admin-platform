(() => {
  const titles = {
    dashboard: "نظرة عامة", teachers: "الأساتذة", "teacher-profile": "ملف الأستاذ بومدين", groups: "الأفواج والحصص",
    students: "التلاميذ", payments: "المدفوعات", notifications: "الإشعارات"
  };
  const navLinks = [...document.querySelectorAll(".nav-link")];
  const pages = [...document.querySelectorAll(".page")];
  const title = document.getElementById("pageTitle");
  const crumb = document.getElementById("crumb");
  const sidebar = document.getElementById("sidebar");
  const toast = document.getElementById("toast");
  let toastTimer;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function navigate(page) {
    if (!titles[page]) return;
    navLinks.forEach(link => link.classList.toggle("active", link.dataset.page === page));
    pages.forEach(section => section.classList.toggle("active", section.id === `page-${page}`));
    title.textContent = titles[page];
    crumb.textContent = titles[page];
    sidebar.classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  navLinks.forEach(link => link.addEventListener("click", () => navigate(link.dataset.page)));
  document.querySelectorAll("[data-goto]").forEach(button =>
    button.addEventListener("click", () => navigate(button.dataset.goto))
  );

  document.getElementById("menuToggle").addEventListener("click", () => sidebar.classList.toggle("open"));
  document.getElementById("topNotification").addEventListener("click", () => navigate("notifications"));

  // These actions are intentionally informational until secure admin API endpoints exist.
  document.getElementById("addTeacher").addEventListener("click", () =>
    showToast("إضافة الأستاذ ستُفعّل بعد ربط واجهة الإدارة بالسيرفر الآمن.")
  );
  document.getElementById("addGroup").addEventListener("click", () =>
    showToast("إضافة فوج ستُفعّل بعد تجهيز صلاحيات الإدارة في السيرفر.")
  );

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") sidebar.classList.remove("open");
  });
})();