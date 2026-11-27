import { icon } from "./icons.js";

// Convierte los controles nativos en componentes visuales sin cambiar sus valores de formulario.
let controlId = 0;
let activeControl = null;
let eventsInstalled = false;

const weekdays = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function nextId(prefix) {
  controlId += 1;
  return `${prefix}-${controlId}`;
}

function inputLabel(input, root) {
  const label = [...root.querySelectorAll("label[for]")].find(
    (candidate) => candidate.htmlFor === input.id,
  );
  if (label && !label.id) label.id = nextId("control-label");
  return label || null;
}

function connectLabel(input, trigger, root) {
  const label = inputLabel(input, root);
  if (label) {
    label.htmlFor = trigger.id;
    trigger.setAttribute("aria-labelledby", label.id);
  } else {
    trigger.setAttribute("aria-label", input.name || "Seleccionar opción");
  }
}

function buildPopover(wrapper, name, role) {
  const popover = document.createElement("div");
  popover.id = nextId(name);
  popover.className = `custom-control-popover ${name}-popover`;
  popover.dataset.controlPopover = name;
  popover.setAttribute("role", role);
  popover.hidden = true;

  if (typeof popover.showPopover === "function") {
    popover.setAttribute("popover", "manual");
  } else {
    popover.dataset.fallback = "true";
  }

  wrapper.append(popover);
  return popover;
}

function showPopover(control, width, maxHeight = 320) {
  if (activeControl && activeControl !== control)
    closeControl(activeControl);

  const { popover, trigger, wrapper } = control;
  activeControl = control;
  wrapper.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
  popover.hidden = false;

  popover.style.width = `${Math.min(width, window.innerWidth - 24)}px`;
  popover.style.maxHeight = `${Math.min(maxHeight, window.innerHeight - 24)}px`;
  if (typeof popover.showPopover !== "function") return;

  popover.showPopover();

  const bounds = trigger.getBoundingClientRect();
  const menuBounds = popover.getBoundingClientRect();
  const left = Math.max(
    12,
    Math.min(bounds.left, window.innerWidth - menuBounds.width - 12),
  );
  const below = window.innerHeight - bounds.bottom - 10;
  const above = bounds.top - 10;
  const top =
    below >= menuBounds.height || below >= above
      ? Math.min(bounds.bottom + 8, window.innerHeight - menuBounds.height - 12)
      : Math.max(12, bounds.top - menuBounds.height - 8);

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function closeControl(control, restoreFocus = false) {
  if (!control) return;

  const { popover, trigger, wrapper } = control;
  if (typeof popover.hidePopover === "function") {
    try {
      popover.hidePopover();
    } catch {
      // Puede haberse cerrado por Escape en el navegador antes de este evento.
    }
  }

  popover.hidden = true;
  wrapper.classList.remove("is-open");
  trigger.setAttribute("aria-expanded", "false");
  trigger.removeAttribute("aria-activedescendant");
  control.listbox?.querySelectorAll(".is-active").forEach((option) => {
    option.classList.remove("is-active");
  });

  if (activeControl === control) activeControl = null;
  if (restoreFocus && !trigger.disabled) trigger.focus();
}

function closeActiveControl(restoreFocus = false) {
  closeControl(activeControl, restoreFocus);
}

function syncSelect(control) {
  const { select, trigger } = control;
  const option = select.options[select.selectedIndex];
  control.value.textContent = option?.textContent.trim() || "Elegir una opción";
  trigger.disabled = select.disabled;
  trigger.setAttribute("aria-required", String(select.required));
  trigger.removeAttribute("aria-invalid");
  trigger.classList.remove("is-invalid");
  updateSelectOptions(control);
}

function updateSelectOptions(control) {
  const { listbox, select, trigger, activeIndex } = control;
  const options = [...listbox.querySelectorAll("[role='option']")];

  options.forEach((optionButton, index) => {
    optionButton.classList.remove("is-active");
    const selected = index === select.selectedIndex;
    optionButton.setAttribute("aria-selected", String(selected));
    optionButton.classList.toggle("is-selected", selected);
  });

  if (Number.isInteger(activeIndex) && options[activeIndex]) {
    trigger.setAttribute("aria-activedescendant", options[activeIndex].id);
    options[activeIndex].classList.add("is-active");
  }
}

function renderSelectOptions(control) {
  const { listbox, select } = control;
  listbox.replaceChildren();

  [...select.options].forEach((option, index) => {
    if (option.parentElement instanceof HTMLOptGroupElement) {
      const groupLabel = option.parentElement.label;
      const previousOption = select.options[index - 1];
      const previousGroup =
        previousOption?.parentElement instanceof HTMLOptGroupElement
          ? previousOption.parentElement.label
          : "";

      if (groupLabel && groupLabel !== previousGroup) {
        const heading = document.createElement("div");
        heading.className = "custom-select-group";
        heading.textContent = groupLabel;
        listbox.append(heading);
      }
    }

    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.tabIndex = -1;
    optionButton.id = `${listbox.id}-option-${index}`;
    optionButton.className = "custom-select-option";
    optionButton.setAttribute("role", "option");
    optionButton.setAttribute("aria-selected", "false");
    optionButton.dataset.selectOption = String(index);
    optionButton.textContent = option.textContent.trim();

    if (option.disabled) {
      optionButton.disabled = true;
      optionButton.setAttribute("aria-disabled", "true");
    }

    listbox.append(optionButton);
  });

  updateSelectOptions(control);
}

function enhanceSelect(select, root) {
  if (select.multiple || select.size > 1 || select.dataset.customized) return;
  if (select.closest(".custom-select-control")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "custom-select-control";
  wrapper.dataset.controlWrapper = "select";
  select.before(wrapper);
  wrapper.append(select);

  if (!select.id) select.id = nextId("select");

  const trigger = document.createElement("button");
  trigger.id = nextId("select-trigger");
  trigger.className = "custom-select-trigger";
  trigger.type = "button";
  trigger.dataset.customSelectTrigger = "true";
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const value = document.createElement("span");
  value.className = "custom-select-value";
  trigger.append(value);

  const chevron = document.createElement("span");
  chevron.className = "custom-select-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = icon("chevronDown");
  trigger.append(chevron);

  const listbox = buildPopover(wrapper, "custom-select", "listbox");
  listbox.id = nextId("select-options");
  trigger.setAttribute("aria-controls", listbox.id);

  const control = {
    type: "select",
    wrapper,
    select,
    trigger,
    popover: listbox,
    listbox,
    value,
    activeIndex: -1,
  };

  renderSelectOptions(control);
  syncSelect(control);
  connectLabel(select, trigger, root);

  select.dataset.customized = "true";
  select.classList.add("custom-control-native");
  select.setAttribute("aria-hidden", "true");
  select.tabIndex = -1;

  select.addEventListener("change", () => syncSelect(control));
  select.addEventListener("invalid", (event) => {
    event.preventDefault();
    trigger.classList.add("is-invalid");
    trigger.setAttribute("aria-invalid", "true");
    trigger.focus();
  });

  wrapper.append(trigger);
  listbox.setAttribute("aria-labelledby", trigger.getAttribute("aria-labelledby") || "");
  storeControl(wrapper, control);
}

function dateFromValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function displayDate(value) {
  const date = dateFromValue(value);
  if (!date) return "dd/mm/aaaa";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function dateLabel(date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function calendarCanSelect(input, date) {
  const value = dateKey(date);
  return (!input.min || value >= input.min) && (!input.max || value <= input.max);
}

function renderCalendar(control) {
  const { input, popover } = control;
  const year = control.viewDate.getFullYear();
  const month = control.viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const firstDate = new Date(year, month, 1 - startOffset);
  const selectedValue = input.value;
  const todayValue = dateKey(new Date());
  const todayDisabled = !calendarCanSelect(input, new Date());
  const monthLabel = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(firstOfMonth);

  popover.innerHTML = `
    <div class="custom-calendar-heading">
      <button type="button" data-calendar-shift="-1" aria-label="Mes anterior">‹</button>
      <strong data-calendar-month aria-live="polite">${monthLabel}</strong>
      <button type="button" data-calendar-shift="1" aria-label="Mes siguiente">›</button>
    </div>
    <div class="custom-calendar-weekdays" role="row">
      ${weekdays.map((day) => `<span role="columnheader">${day}</span>`).join("")}
    </div>
    <div class="custom-calendar-days" role="grid" aria-label="${monthLabel}">
      ${Array.from({ length: 42 }, (_value, index) => {
        const date = new Date(
          firstDate.getFullYear(),
          firstDate.getMonth(),
          firstDate.getDate() + index,
        );
        const value = dateKey(date);
        const otherMonth = date.getMonth() !== month;
        const selected = value === selectedValue;
        const today = value === todayValue;
        const disabled = !calendarCanSelect(input, date);
        const classes = [
          "custom-calendar-day",
          otherMonth ? "is-other-month" : "",
          selected ? "is-selected" : "",
          today ? "is-today" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return `<button type="button" class="${classes}" role="gridcell" data-calendar-date="${value}" aria-label="${dateLabel(date)}" aria-selected="${selected}" ${disabled ? "disabled" : ""}>${date.getDate()}</button>`;
      }).join("")}
    </div>
    <div class="custom-calendar-footer">
      <button type="button" data-calendar-clear ${input.required ? "disabled" : ""}>Limpiar</button>
      <button type="button" data-calendar-today ${todayDisabled ? "disabled" : ""}>Hoy</button>
    </div>
  `;
}

function updateDateTrigger(control) {
  const { input, trigger } = control;
  control.value.textContent = displayDate(input.value);
  trigger.disabled = input.disabled;
  trigger.classList.toggle("has-value", Boolean(input.value));
  trigger.setAttribute("aria-required", String(input.required));
  trigger.removeAttribute("aria-invalid");
  trigger.classList.remove("is-invalid");
}

function enhanceDate(input, root) {
  if (input.dataset.customized) return;
  if (input.closest(".custom-date-control")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "custom-date-control";
  wrapper.dataset.controlWrapper = "date";
  input.before(wrapper);
  wrapper.append(input);

  if (!input.id) input.id = nextId("date");

  const trigger = document.createElement("button");
  trigger.id = nextId("date-trigger");
  trigger.className = "custom-date-trigger";
  trigger.type = "button";
  trigger.dataset.customDateTrigger = "true";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");

  const value = document.createElement("span");
  value.className = "custom-date-value";
  trigger.append(value);

  const calendarIcon = document.createElement("span");
  calendarIcon.className = "custom-date-icon";
  calendarIcon.setAttribute("aria-hidden", "true");
  calendarIcon.innerHTML = icon("calendar");
  trigger.append(calendarIcon);

  const popover = buildPopover(wrapper, "custom-calendar", "dialog");
  popover.setAttribute("aria-label", "Elegir fecha");
  trigger.setAttribute("aria-controls", popover.id);

  const control = {
    type: "date",
    wrapper,
    input,
    trigger,
    popover,
    value,
    viewDate: dateFromValue(input.value) || new Date(),
  };

  renderCalendar(control);
  updateDateTrigger(control);
  connectLabel(input, trigger, root);

  input.dataset.customized = "true";
  input.classList.add("custom-control-native");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;

  input.addEventListener("change", () => updateDateTrigger(control));
  input.addEventListener("input", () => updateDateTrigger(control));
  input.addEventListener("invalid", (event) => {
    event.preventDefault();
    trigger.classList.add("is-invalid");
    trigger.setAttribute("aria-invalid", "true");
    trigger.focus();
  });

  wrapper.append(trigger);
  storeControl(wrapper, control);
}

function enhanceFileInputs(root) {
  root.querySelectorAll('input[type="file"]').forEach((input) => {
    input.classList.add("styled-file-input");
  });
}

export function enhanceControls(root) {
  if (!root) return;

  if (!eventsInstalled) {
    installControlEvents();
    eventsInstalled = true;
  }

  root.querySelectorAll("select").forEach((select) => enhanceSelect(select, root));
  root.querySelectorAll('input[type="date"]').forEach((input) =>
    enhanceDate(input, root),
  );
  enhanceFileInputs(root);
}

export function disposeControls(root) {
  if (!root) return;

  if (activeControl && root.contains(activeControl.wrapper))
    closeControl(activeControl);

  root.querySelectorAll("[data-control-wrapper]").forEach((wrapper) => {
    const popover = wrapper.querySelector("[data-control-popover]");
    if (!popover) return;

    if (typeof popover.hidePopover === "function") {
      try {
        popover.hidePopover();
      } catch {
        // El panel puede estar cerrado si el navegador lo descartó al cerrar el modal.
      }
    }

    popover.remove();
  });
}

function openSelect(control, direction = 1) {
  control.activeIndex = control.select.selectedIndex;
  if (control.activeIndex < 0 || control.select.options[control.activeIndex]?.disabled)
    control.activeIndex = findEnabledOption(control, direction > 0 ? 0 : control.select.options.length - 1, direction);

  showPopover(control, Math.max(control.trigger.getBoundingClientRect().width, 220));
  updateSelectOptions(control);
  control.listbox
    .querySelector(`[data-select-option="${control.activeIndex}"]`)
    ?.scrollIntoView({ block: "nearest" });
}

function findEnabledOption(control, start, direction) {
  const options = [...control.select.options];
  for (let index = start; index >= 0 && index < options.length; index += direction) {
    if (!options[index].disabled) return index;
  }
  return -1;
}

function setActiveOption(control, index) {
  control.activeIndex = index;
  control.listbox.querySelectorAll("[role='option']").forEach((option) => {
    option.classList.remove("is-active");
  });
  updateSelectOptions(control);
  control.listbox
    .querySelector(`[data-select-option="${index}"]`)
    ?.scrollIntoView({ block: "nearest" });
}

function chooseOption(control, index) {
  const option = control.select.options[index];
  if (!option || option.disabled) return;

  control.select.selectedIndex = index;
  syncSelect(control);
  closeControl(control, true);
  control.select.dispatchEvent(new Event("input", { bubbles: true }));
  control.select.dispatchEvent(new Event("change", { bubbles: true }));
}

function updateCalendarView(control, monthOffset) {
  control.viewDate = new Date(
    control.viewDate.getFullYear(),
    control.viewDate.getMonth() + monthOffset,
    1,
  );
  renderCalendar(control);

  const visibleDate = dateFromValue(control.input.value);
  const focusDate =
    visibleDate && visibleDate.getMonth() === control.viewDate.getMonth()
      ? dateKey(visibleDate)
      : [...control.popover.querySelectorAll("[data-calendar-date]:not(:disabled)")][0]
          ?.dataset.calendarDate;
  if (focusDate) focusCalendarDate(control, focusDate);
}

function focusCalendarDate(control, value) {
  control.popover
    .querySelector(`[data-calendar-date="${value}"]`)
    ?.focus({ preventScroll: true });
}

function setDateValue(control, value) {
  control.input.value = value;
  updateDateTrigger(control);
  closeControl(control, true);
  control.input.dispatchEvent(new Event("input", { bubbles: true }));
  control.input.dispatchEvent(new Event("change", { bubbles: true }));
}

function openCalendar(control) {
  control.viewDate = dateFromValue(control.input.value) || new Date();
  control.viewDate = new Date(
    control.viewDate.getFullYear(),
    control.viewDate.getMonth(),
    1,
  );
  renderCalendar(control);
  showPopover(control, 320, 380);

  const focusDate = control.input.value || dateKey(new Date());
  const currentMonth = control.viewDate.getMonth();
  const focusButton = control.popover.querySelector(
    `[data-calendar-date="${focusDate}"]:not(:disabled)`,
  );
  if (focusButton && dateFromValue(focusDate)?.getMonth() === currentMonth) {
    focusButton.focus({ preventScroll: true });
  } else {
    control.popover
      .querySelector("[data-calendar-date]:not(:disabled)")
      ?.focus({ preventScroll: true });
  }
}

function handleSelectKeydown(event, trigger) {
  const wrapper = trigger.closest(".custom-select-control");
  const control = wrapper?.__customControl;
  if (!control) return;

  const open = activeControl === control;
  const enabledCount = [...control.select.options].filter(
    (option) => !option.disabled,
  ).length;
  if (!enabledCount) return;

  if (["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    if (!open) {
      openSelect(control, event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const next = findEnabledOption(
      control,
      Math.max(0, control.activeIndex + direction),
      direction,
    );
    if (next >= 0) setActiveOption(control, next);
    return;
  }

  if (event.key === "Home" || event.key === "End") {
    if (!open) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : control.select.options.length - 1;
    const direction = event.key === "Home" ? 1 : -1;
    setActiveOption(control, findEnabledOption(control, index, direction));
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (!open) openSelect(control);
    else chooseOption(control, control.activeIndex);
  }
}

function handleCalendarKeydown(event, control) {
  const dayButton = event.target.closest("[data-calendar-date]");
  if (!dayButton) return;

  const date = dateFromValue(dayButton.dataset.calendarDate);
  const offsets = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
    Home: -((date.getDay() + 6) % 7),
    End: 6 - ((date.getDay() + 6) % 7),
  };

  if (event.key === "PageUp" || event.key === "PageDown") {
    event.preventDefault();
    updateCalendarView(control, event.key === "PageUp" ? -1 : 1);
    return;
  }

  const offset = offsets[event.key];
  if (offset === undefined) return;
  event.preventDefault();
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
  const nextValue = dateKey(nextDate);

  if (
    nextDate.getMonth() !== control.viewDate.getMonth() ||
    nextDate.getFullYear() !== control.viewDate.getFullYear()
  ) {
    control.viewDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
    renderCalendar(control);
  }
  focusCalendarDate(control, nextValue);
}

function installControlEvents() {
  document.addEventListener("click", (event) => {
    const selectTrigger = event.target.closest("[data-custom-select-trigger]");
    if (selectTrigger) {
      const control = selectTrigger.closest(".custom-select-control")?.__customControl;
      if (!control || selectTrigger.disabled) return;
      if (activeControl === control) closeControl(control);
      else openSelect(control);
      return;
    }

    const dateTrigger = event.target.closest("[data-custom-date-trigger]");
    if (dateTrigger) {
      const control = dateTrigger.closest(".custom-date-control")?.__customControl;
      if (!control || dateTrigger.disabled) return;
      if (activeControl === control) closeControl(control);
      else openCalendar(control);
      return;
    }

    const selectOption = event.target.closest("[data-select-option]");
    if (selectOption) {
      const control = activeControl;
      if (control?.type === "select")
        chooseOption(control, Number(selectOption.dataset.selectOption));
      return;
    }

    const calendarButton = event.target.closest("[data-calendar-shift]");
    if (calendarButton && activeControl?.type === "date") {
      updateCalendarView(activeControl, Number(calendarButton.dataset.calendarShift));
      return;
    }

    const calendarDate = event.target.closest("[data-calendar-date]");
    if (calendarDate && activeControl?.type === "date") {
      setDateValue(activeControl, calendarDate.dataset.calendarDate);
      return;
    }

    const calendarToday = event.target.closest("[data-calendar-today]");
    if (calendarToday && activeControl?.type === "date") {
      const today = new Date();
      if (calendarCanSelect(activeControl.input, today))
        setDateValue(activeControl, dateKey(today));
      return;
    }

    const calendarClear = event.target.closest("[data-calendar-clear]");
    if (calendarClear && activeControl?.type === "date") {
      setDateValue(activeControl, "");
      return;
    }

    if (
      activeControl &&
      !activeControl.wrapper.contains(event.target) &&
      !activeControl.popover.contains(event.target)
    ) {
      closeControl(activeControl);
    }
  });

  document.addEventListener("keydown", (event) => {
    const selectTrigger = event.target.closest?.("[data-custom-select-trigger]");
    if (selectTrigger) {
      handleSelectKeydown(event, selectTrigger);
      return;
    }

    if (activeControl?.type === "date")
      handleCalendarKeydown(event, activeControl);

    if (event.key === "Escape" && activeControl) {
      event.preventDefault();
      closeControl(activeControl, true);
    }
  });

  document.addEventListener(
    "scroll",
    () => closeActiveControl(),
    true,
  );
  document.addEventListener("focusin", (event) => {
    // Los elementos de opción son un listbox con foco en el disparador; al
    // pulsar una opción el navegador puede mover el foco al body antes del click.
    if (
      event.target === document.body ||
      event.target === document.documentElement
    )
      return;

    if (
      activeControl &&
      !activeControl.wrapper.contains(event.target) &&
      !activeControl.popover.contains(event.target)
    ) {
      closeControl(activeControl);
    }
  });
  window.addEventListener("resize", () => closeActiveControl());

  document.addEventListener("reset", (event) => {
    window.setTimeout(() => {
      event.target.querySelectorAll("select").forEach((select) => {
        const control = select.closest(".custom-select-control")?.__customControl;
        if (control) syncSelect(control);
      });
      event.target.querySelectorAll('input[type="date"]').forEach((input) => {
        const control = input.closest(".custom-date-control")?.__customControl;
        if (control) updateDateTrigger(control);
      });
    });
  });
}

// Mantiene la fecha y el valor original para validación y envío del formulario.
function storeControl(wrapper, control) {
  wrapper.__customControl = control;
}

