/* =========================================================
   IslandHF Display Controller
   Stage B — Live Contest Information
   ========================================================= */

const controls = document.querySelectorAll(".info-control");
const powerButton = document.getElementById("powerButton");
const screen = document.getElementById("radioScreen");
const functionBank = document.getElementById("functionBank");

const screenTitle = document.getElementById("screenTitle");
const screenContent = document.getElementById("screenContent");
const screenPrompt = document.getElementById("screenPrompt");
const utcClock = document.getElementById("utcClock");


/* =========================================================
   POWER STATE
   ========================================================= */

function isPoweredOn() {
    return !powerButton.classList.contains("off");
}


function setControlsEnabled(enabled) {

    functionBank.classList.toggle(
        "is-disabled",
        !enabled
    );

    controls.forEach(control => {

        control.disabled = !enabled;

        control.setAttribute(
            "aria-disabled",
            String(!enabled)
        );

    });
}


/* =========================================================
   CLOCK
   ========================================================= */

function updateClock() {

    if (!utcClock) {
        return;
    }

    const now = new Date();

    const hours = String(
        now.getUTCHours()
    ).padStart(2, "0");

    const minutes = String(
        now.getUTCMinutes()
    ).padStart(2, "0");

    const seconds = String(
        now.getUTCSeconds()
    ).padStart(2, "0");

    utcClock.textContent =
        `UTC ${hours}:${minutes}:${seconds}`;
}


setInterval(updateClock, 1000);

updateClock();


/* =========================================================
   TIME FORMATTING
   ========================================================= */

function formatUTC(date) {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "UTC",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    ).format(date);
}


function formatPacific(date) {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "America/Vancouver",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    ).format(date);
}


function formatPacificDate(date) {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "America/Vancouver",
            month: "short",
            day: "numeric"
        }
    ).format(date);
}


/* =========================================================
   CONTEST STATUS
   ========================================================= */

function getContestStatus(start, end) {

    const now = new Date();

    const fiveMinutes =
        5 * 60 * 1000;

    const thirtyMinutes =
        30 * 60 * 1000;


    if (
        now >= start &&
        now <= end
    ) {
        return "ON NOW";
    }


    if (
        start > now &&
        start - now <= fiveMinutes
    ) {
        return "STARTING SOON";
    }


    if (
        start > now &&
        start - now <= thirtyMinutes
    ) {
        return "STARTING SOON";
    }


    return null;
}


/* =========================================================
   CONTEST CARD
   ========================================================= */

function createContestCard(contest, session) {

    const start = new Date(session.startUTC);
    const end = new Date(session.endUTC);

    const status = getContestStatus(start, end);

    const card = document.createElement("div");

    card.className = "contest-row";

    if (status === "ON NOW") {
        card.classList.add("active");
    } else if (status === "STARTING SOON") {
        card.classList.add("soon");
    }


    /* -----------------------------------------------------
       Date column
       ----------------------------------------------------- */

    const date = document.createElement("div");

    date.className = "contest-date";

    const month = document.createElement("span");

    month.className = "month";

    month.textContent =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone: "America/Vancouver",
                month: "short"
            }
        ).format(start);


    const day = document.createElement("span");

    day.className = "days";

    day.textContent =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone: "America/Vancouver",
                day: "numeric"
            }
        ).format(start);


    date.appendChild(month);
    date.appendChild(day);


    /* -----------------------------------------------------
       Contest details
       ----------------------------------------------------- */

    const details =
        document.createElement("div");

    details.className =
        "contest-details";


    const name =
        document.createElement("span");

    name.className =
        "contest-name";

    name.textContent =
        contest.name;


    const time =
        document.createElement("div");

    time.className =
        "contest-time";

    time.textContent =
        `${formatUTC(start)}–${formatUTC(end)} UTC  •  ` +
        `${formatPacific(start)}–${formatPacific(end)} PST`;


    const meta =
        document.createElement("div");

    meta.className =
        "contest-meta";

    meta.textContent =
        "WA7BNM Contest Calendar";


    details.appendChild(name);
    details.appendChild(time);
    details.appendChild(meta);


    /* -----------------------------------------------------
       Assemble contest row
       ----------------------------------------------------- */

    card.appendChild(date);
    card.appendChild(details);


    return card;
}


/* =========================================================
   LOAD CONTEST DATA
   ========================================================= */

async function loadContestData() {

    const response =
        await fetch(
            "data/contests.json",
            {
                cache: "no-store"
            }
        );


    if (!response.ok) {

        throw new Error(
            `Contest data HTTP ${response.status}`
        );

    }


    return await response.json();
}


/* =========================================================
   CONTEST DISPLAY
   ========================================================= */

async function renderContestInfo() {

    screenTitle.textContent =
        "CONTEST INFO";


    screenContent.innerHTML = `
        <div class="section-display">
            <h2>CONTEST INFO</h2>

            <div class="section-subtitle">
                Contests • Calendar • Results
            </div>

            <p class="section-intro">
                Loading WA7BNM contest information...
            </p>
        </div>
    `;


    try {

        const data =
            await loadContestData();


        const now =
            new Date();


        const contests =
            [];


        /*
         * Flatten all contest sessions.
         */

        data.contests.forEach(
            contest => {

                if (
                    !contest.sessions ||
                    !contest.sessions.length
                ) {
                    return;
                }


                contest.sessions.forEach(
                    session => {

                        const start =
                            new Date(
                                session.startUTC
                            );

                        const end =
                            new Date(
                                session.endUTC
                            );


                        contests.push({
                            contest,
                            session,
                            start,
                            end
                        });

                    }
                );

            }
        );


        /*
         * Sort chronologically.
         */

        contests.sort(
            (a, b) =>
                a.start - b.start
        );


        /*
         * First show contests
         * currently running.
         */

        const active =
            contests.filter(
                item =>
                    now >= item.start &&
                    now <= item.end
            );


        /*
         * Then contests beginning
         * within the next 30 minutes.
         */

        const soon =
            contests.filter(
                item =>
                    item.start > now &&
                    item.start - now <=
                        30 * 60 * 1000
            );


        /*
         * Then later today.
         */

        const today =
            contests.filter(
                item => {

                    const localDate =
                        new Intl.DateTimeFormat(
                            "en-CA",
                            {
                                timeZone:
                                    "America/Vancouver",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }
                        ).format(item.start);


                    const currentLocalDate =
                        new Intl.DateTimeFormat(
                            "en-CA",
                            {
                                timeZone:
                                    "America/Vancouver",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }
                        ).format(now);


                    return (
                        localDate ===
                            currentLocalDate &&
                        item.start > now
                    );

                }
            );


        /*
         * Build the display list.
         */

        let selected = [];


        active.forEach(
            item => {

                if (
                    !selected.includes(item)
                ) {
                    selected.push(item);
                }

            }
        );


        soon.forEach(
            item => {

                if (
                    !selected.includes(item)
                ) {
                    selected.push(item);
                }

            }
        );


        today.forEach(
            item => {

                if (
                    !selected.includes(item)
                ) {
                    selected.push(item);
                }

            }
        );


        /*
         * If today's contests have been
         * exhausted, add upcoming contests.
         */

        if (selected.length < 3) {

            contests.forEach(
                item => {

                    if (
                        item.start <= now
                    ) {
                        return;
                    }


                    if (
                        selected.includes(item)
                    ) {
                        return;
                    }


                    selected.push(item);

                }
            );

        }


        /*
         * Limit the initial radio display.
         */

        selected =
            selected.slice(0, 3);


        /*
         * Render.
         */

        screenContent.innerHTML = "";


        const wrapper =
            document.createElement("div");

        wrapper.className =
            "section-display";


        const heading =
            document.createElement("h2");

        heading.textContent =
            "CONTEST INFO";


        const subtitle =
            document.createElement("div");

        subtitle.className =
            "section-subtitle";

        subtitle.textContent =
            `${data.contestCount} contests • WA7BNM`;


        wrapper.appendChild(
            heading
        );

        wrapper.appendChild(
            subtitle
        );


        if (!selected.length) {

            const message =
                document.createElement("p");

            message.className =
                "section-intro";

            message.textContent =
                "No current contests found.";

            wrapper.appendChild(
                message
            );

        } else {

            selected.forEach(
                item => {

                    wrapper.appendChild(
                        createContestCard(
                            item.contest,
                            item.session
                        )
                    );

                }
            );

        }


        screenContent.appendChild(
            wrapper
        );


        screenPrompt.textContent =
            "WA7BNM CONTEST CALENDAR";


    } catch (error) {

        console.error(
            "Contest data error:",
            error
        );


        screenContent.innerHTML = `
            <div class="section-display">

                <h2>CONTEST INFO</h2>

                <div class="section-subtitle">
                    Contests • Calendar • Results
                </div>

                <p class="section-intro">
                    Contest data could not be loaded.
                </p>

                <div class="contest-status">

                    <strong>
                        DATA ERROR
                    </strong>

                    <span>
                        Check data/contests.json
                    </span>

                </div>

            </div>
        `;


        screenPrompt.textContent =
            "WA7BNM DATA ERROR";

    }

}


/* =========================================================
   GENERIC SECTION DISPLAY
   ========================================================= */

function renderSection(section) {

    if (section === "contest") {

        renderContestInfo();

        return;
    }


    const data =
        islandHFData[section];


    if (!data) {
        return;
    }


    screenTitle.textContent =
        data.title;


    let html = `

        <div class="section-display">

            <h2>
                ${data.title}
            </h2>

            <div class="section-subtitle">
                ${data.subtitle}
            </div>

            <p class="section-intro">
                ${data.intro}
            </p>

            <div class="info-cards">
    `;


    data.cards.forEach(
        card => {

            html += `

                <div class="info-card">

                    <strong>
                        ${card[0]}
                    </strong>

                    <span>
                        ${card[1]}
                    </span>

                </div>

            `;

        }
    );


    html += `

            </div>

        </div>

    `;


    screenContent.innerHTML =
        html;


    screenPrompt.textContent =
        "ISLANDHF LIVE INFORMATION SYSTEM";
}


/* =========================================================
   WELCOME SCREEN
   ========================================================= */

function renderWelcome() {

    screenTitle.textContent =
        "ISLANDHF";


    screenContent.innerHTML = `

        <div class="welcome-screen">

            <h2>
                IslandHF
            </h2>

            <p>
                Amateur Radio from Vancouver Island
            </p>

            <p class="welcome-message">
                Select an information control below.
            </p>

        </div>

    `;


    screenPrompt.textContent =
        "ISLANDHF LIVE INFORMATION SYSTEM";
}


/* =========================================================
   INFORMATION CONTROL EVENTS
   ========================================================= */

controls.forEach(
    control => {

        control.addEventListener(
            "click",
            () => {

                if (!isPoweredOn()) {
                    return;
                }


                controls.forEach(
                    item =>
                        item.classList.remove(
                            "active"
                        )
                );


                control.classList.add(
                    "active"
                );


                const section =
                    control.dataset.section;


                renderSection(
                    section
                );

            }
        );

    }
);


/* =========================================================
   POWER BUTTON
   ========================================================= */

powerButton.addEventListener(
    "click",
    () => {

        const turningOn =
            powerButton.classList.contains(
                "off"
            );


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


        setControlsEnabled(
            turningOn
        );


        if (!turningOn) {

            controls.forEach(
                item =>
                    item.classList.remove(
                        "active"
                    )
            );


            screenTitle.textContent =
                "";


            screenContent.innerHTML =
                "";


            screenPrompt.textContent =
                "POWER OFF";


        } else {

            renderWelcome();

        }

    }
);


/* =========================================================
   INITIAL STATE
   ========================================================= */

setControlsEnabled(false);

screen.classList.add(
    "powered-off"
);

screenTitle.textContent =
    "";

screenContent.innerHTML =
    "";

screenPrompt.textContent =
    "POWER OFF";