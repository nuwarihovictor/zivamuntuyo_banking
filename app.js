document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach(button => {
      button.classList.remove("active");
    });

    btn.classList.add("active");

    const page = btn.dataset.page;
    $("title").textContent = page;

    if (page === "Overview") {
      $("dashboard").classList.remove("hidden");
      $("placeholder").classList.add("hidden");
    } else {
      $("dashboard").classList.add("hidden");
      $("placeholder").classList.remove("hidden");
      $("placeholder-title").textContent = page + " module";
    }
  });
});
