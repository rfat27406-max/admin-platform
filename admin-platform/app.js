
(() => {
  const titles = {
    dashboard: "نظرة عامة",
    teachers: "الأساتذة",
    "teacher-profile": "ملف الأستاذ بومدين",
    groups: "الأفواج والحصص",
    students: "التلاميذ",
    payments: "المدفوعات",
    notifications: "الإشعارات"
  };

  const navLinks = [...document.querySelectorAll(".nav-link")];
  const pages = [...document.querySelectorAll(".page")];
  const title = document.getElementById("pageTitle");
  const crumb = document.getElementById("crumb");
  const sidebar = document.getElementById("sidebar");
  const toast = document.getElementById("toast");
  let toastTimer;

  const API_BASE = "https://school-server.rfat27406.workers.dev";

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function navigate(page) {
    if (!titles[page]) return;

    navLinks.forEach(link =>
      link.classList.toggle("active", link.dataset.page === page)
    );

    pages.forEach(section =>
      section.classList.toggle("active", section.id === `page-${page}`)
    );

    if (title) title.textContent = titles[page];
    if (crumb) crumb.textContent = titles[page];
    if (sidebar) sidebar.classList.remove("open");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  navLinks.forEach(link =>
    link.addEventListener("click", () => navigate(link.dataset.page))
  );

  document.querySelectorAll("[data-goto]").forEach(button =>
    button.addEventListener("click", () => navigate(button.dataset.goto))
  );

  document.getElementById("menuToggle")?.addEventListener("click", () =>
    sidebar?.classList.toggle("open")
  );

  document.getElementById("topNotification")?.addEventListener("click", () =>
    navigate("notifications")
  );

  document.getElementById("addTeacher")?.addEventListener("click", () =>
    showToast("إضافة الأستاذ ستُفعّل في مرحلة إدارة الأساتذة.")
  );

  document.getElementById("addGroup")?.addEventListener("click", () =>
    showToast("إضافة فوج ستُفعّل في مرحلة إدارة الأفواج.")
  );

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") sidebar?.classList.remove("open");
  });

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function weekdayArabic(value) {
    if (value === "friday") return "الجمعة";
    if (value === "saturday") return "السبت";
    return value || "—";
  }

  function groupName(value) {
    const name = String(value || "");
    return name.startsWith("الفوج") ? name : (name ? `الفوج ${name}` : "فوج");
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = String(value).slice(0, 10);
    const parts = date.split("-");

    if (parts.length !== 3) return escapeHTML(value);

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // تحميل الأفواج
  async function loadGroupsFromServer() {
    try {
      const response = await fetch(`${API_BASE}/api/groups`);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      const groups = Array.isArray(payload.groups) ? payload.groups : [];

      const groupRows = groups.map(group => `
        <tr>
          <td><b>${escapeHTML(groupName(group.name))}</b></td>
          <td>${escapeHTML(weekdayArabic(group.weekday))}</td>
          <td>${escapeHTML(group.start_time)} — ${escapeHTML(group.end_time)}</td>
          <td>بومدين</td>
          <td>${escapeHTML(group.price_dzd)} دج</td>
          <td>علوم طبيعية</td>
        </tr>
      `).join("");

      const groupTbody = document.querySelector("#page-groups table tbody");

      if (groupTbody) {
        groupTbody.innerHTML = groupRows ||
          '<tr><td colspan="6">لا توجد أفواج نشطة حالياً.</td></tr>';
      }

      const profileTbody = document.querySelector("#page-teacher-profile table tbody");

      if (profileTbody) {
        profileTbody.innerHTML = groups.map(group => `
          <tr>
            <td><b>${escapeHTML(groupName(group.name))}</b></td>
            <td>${escapeHTML(weekdayArabic(group.weekday))}</td>
            <td>${escapeHTML(group.start_time)} — ${escapeHTML(group.end_time)}</td>
            <td>علوم طبيعية</td>
            <td>${escapeHTML(group.price_dzd)} دج</td>
            <td><span class="status status-active">نشط</span></td>
          </tr>
        `).join("") ||
          '<tr><td colspan="6">لا توجد أفواج نشطة حالياً.</td></tr>';
      }

      const scheduleList = document.querySelector("#page-dashboard .schedule-list");

      if (scheduleList) {
        scheduleList.innerHTML = groups.map(group => `
          <div class="schedule-row">
            <span class="day-badge">${escapeHTML(weekdayArabic(group.weekday))}</span>
            <div class="schedule-info">
              <b>${escapeHTML(groupName(group.name))}</b>
              <small>${escapeHTML(group.start_time)} — ${escapeHTML(group.end_time)}</small>
            </div>
            <span class="subject">علوم طبيعية</span>
          </div>
        `).join("") ||
          '<p class="empty-hint">لا توجد أفواج نشطة حالياً.</p>';
      }

      const groupCount = document.querySelector(
        "#page-teacher-profile .profile-stats .stat-card strong"
      );

      if (groupCount) {
        groupCount.textContent = String(groups.length).padStart(2, "0");
      }

      const dashboardGroupStat = [
        ...document.querySelectorAll("#page-dashboard .stat-card")
      ].find(card =>
        card.querySelector(".stat-label")?.textContent.trim() === "الأفواج"
      );

      if (dashboardGroupStat) {
        const value = dashboardGroupStat.querySelector("strong");
        if (value) value.textContent = String(groups.length).padStart(2, "0");
      }

      showToast("تم تحميل الأفواج من قاعدة بيانات المدرسة.");

    } catch (error) {
      console.error("تعذر تحميل الأفواج:", error);
      showToast("تعذر تحميل الأفواج من السيرفر.");
    }
  }

  // تحميل التلاميذ
  async function loadStudentsFromServer() {
    try {
      const response = await fetch(`${API_BASE}/api/admin/students`);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      const students = Array.isArray(payload.students) ? payload.students : [];

      const tbody = document.getElementById("studentsTableBody");

      if (tbody) {
        tbody.innerHTML = students.map(student => `
          <tr>
            <td>
              <b>${escapeHTML(student.first_name)} ${escapeHTML(student.last_name)}</b>
            </td>
            <td>${escapeHTML(student.age)} سنة</td>
            <td>${formatDate(student.created_at)}</td>
            <td>${escapeHTML(student.bookings_count ?? 0)}</td>
            <td>
              <span class="status status-active">
                ${escapeHTML(student.paid_count ?? 0)}
              </span>
            </td>
            <td>
              <span class="status status-pending">
                ${escapeHTML(student.unpaid_count ?? 0)}
              </span>
            </td>
          </tr>
        `).join("") ||
          '<tr><td colspan="6">لا يوجد تلاميذ مسجلون حالياً.</td></tr>';
      }

      const totalBookings = students.reduce(
        (sum, student) => sum + Number(student.bookings_count || 0), 0
      );

      const totalPaid = students.reduce(
        (sum, student) => sum + Number(student.paid_count || 0), 0
      );

      const totalUnpaid = students.reduce(
        (sum, student) => sum + Number(student.unpaid_count || 0), 0
      );

      const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
      };

      setText("studentsTotal", students.length);
      setText("studentsBookings", totalBookings);
      setText("studentsPaid", totalPaid);
      setText("studentsUnpaid", totalUnpaid);
      setText("dashboardStudentsCount", String(students.length).padStart(2, "0"));

      showToast(`تم تحميل ${students.length} تلميذ من قاعدة البيانات.`);

    } catch (error) {
      console.error("تعذر تحميل التلاميذ:", error);

      const tbody = document.getElementById("studentsTableBody");

      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="6">تعذر تحميل البيانات. تحقق من اتصال السيرفر.</td></tr>';
      }

      showToast("تعذر تحميل التلاميذ من السيرفر.");
    }
  }

  // تشغيل تحميل البيانات
  loadGroupsFromServer();
  loadStudentsFromServer();

})();
