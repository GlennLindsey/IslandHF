const controls = document.querySelectorAll(".info-control");
const powerButton = document.getElementById("powerButton");
const functionBank = document.getElementById("functionBank");


function isPoweredOn() {
    return !powerButton.classList.contains("off");
}


function setControlsEnabled(enabled) {
    functionBank.classList.toggle("is-disabled", !enabled);

    controls.forEach(control => {
        control.disabled = !enabled;
        control.setAttribute(
            "aria-disabled",
            String(!enabled)
        );
    });
}


/* =========================================================
   INFORMATION CONTROLS
   ========================================================= */

controls.forEach(control => {

    control.addEventListener("click", () => {

        if (!isPoweredOn()) {
            return;
        }

        controls.forEach(item => {
            item.classList.remove("active");
        });

        control.classList.add("active");

        const section = control.dataset.section;

        renderSection(section);
    });

});


/* =========================================================
   POWER CONTROL
   ========================================================= */

powerButton.addEventListener("click", () => {

    const turningOn =
        powerButton.classList.contains("off");

    powerButton.classList.toggle(
        "off",
        !turningOn
    );

    powerButton.setAttribute(
        "aria-pressed",
        String(turningOn)
    );

    screen.classList.toggle(
        "powered-off",
        !turningOn
    );

    setControlsEnabled(turningOn);


    if (!turningOn) {

        controls.forEach(control => {
            control.classList.remove("active");
        });

        screenTitle.textContent = "";

        screenContent.innerHTML = "";

        screenPrompt.textContent = "POWER OFF";

    } else {

        renderWelcome();

    }

});


/* =========================================================
   INITIAL STATE
   ========================================================= */

setControlsEnabled(false);

screen.classList.add("powered-off");

screenTitle.textContent = "";

screenContent.innerHTML = "";

screenPrompt.textContent = "POWER OFF";