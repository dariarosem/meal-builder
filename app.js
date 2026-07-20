const STARTER_CATEGORIES = [
  {
    "id": "container",
    "name": "Container",
    "items": [
      "Bowl",
      "Plate",
      "Carb"
    ]
  },
  {
    "id": "carb",
    "name": "Carb",
    "items": [
      "Rice",
      "Wrap",
      "Bread",
      "Bun",
      "Quesadilla",
      "Burrito",
      "Crackers",
      "Pasta"
    ]
  },
  {
    "id": "protein",
    "name": "Protein",
    "items": [
      "Hamburger",
      "Chicken",
      "Tuna",
      "Garbanzo beans",
      "Kidney beans",
      "Black beans",
      "Ham",
      "Bacon",
      "Sausage",
      "Pepperoni",
      "Turkey",
      "Peanut butter",
      "Protein shake"
    ]
  },
  {
    "id": "vegetables",
    "name": "Vegetables",
    "items": [
      "Green beans",
      "Corn",
      "Stir fry mix",
      "Normandy",
      "Bell peppers and onions",
      "Sweet potatoes",
      "Lettuce"
    ]
  },
  {
    "id": "fruit",
    "name": "Fruit",
    "items": [
      "Peaches",
      "Pears",
      "Blueberries",
      "Raspberries",
      "Cherries",
      "Strawberries",
      "Kiwi"
    ]
  },
  {
    "id": "dairy",
    "name": "Dairy",
    "items": [
      "Cheddar slices",
      "Gouda chunks",
      "Shredded cheddar",
      "Shredded colby",
      "Shredded mozzarella",
      "Cheese sticks",
      "Yogurt",
      "Cottage cheese",
      "Eggs"
    ]
  },
  {
    "id": "sauce",
    "name": "Sauce",
    "items": [
      "BBQ",
      "Ranch",
      "Italian",
      "Teriyaki",
      "Soy",
      "Sesame",
      "Marinara",
      "Alfredo",
      "Vinaigrette"
    ]
  },
  {
    "id": "extra-toppings",
    "name": "Extra toppings",
    "items": [
      "Bacon bits"
    ]
  },
  {
    "id": "cans",
    "name": "Cans",
    "items": [
      "Spaghettios",
      "Soup",
      "Ravioli"
    ]
  }
];

const STORAGE_KEY = "meal-builder-state-v1";
let state = loadState();
let activeCategoryId = null;
let manageMode = "categories";
let promptResolver = null;

const $ = (selector) => document.querySelector(selector);
const categoryList = $("#categoryList");
const currentMeal = $("#currentMeal");
const categoryDialog = $("#categoryDialog");
const manageDialog = $("#manageDialog");
const savedDialog = $("#savedDialog");
const promptDialog = $("#promptDialog");

function makeId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function initialState() {
  return {
    categories: structuredClone(STARTER_CATEGORIES),
    selections: {},
    savedMeals: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.categories)) return initialState();
    parsed.selections ||= {};
    parsed.savedMeals ||= [];
    return parsed;
  } catch {
    return initialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function selectedItemsFor(category) {
  const chosen = state.selections[category.id] || [];
  return category.items.filter(item => chosen.includes(item));
}

function fullMealText(selections = state.selections) {
  const parts = [];
  for (const category of state.categories) {
    const selected = category.items.filter(item => (selections[category.id] || []).includes(item));
    parts.push(...selected);
  }
  return parts.join(" · ");
}

function render() {
  const meal = fullMealText();
  currentMeal.textContent = meal || "Nothing selected yet";
  categoryList.innerHTML = "";

  state.categories.forEach(category => {
    const chosen = selectedItemsFor(category);
    const button = document.createElement("button");
    button.className = "category-card";
    button.innerHTML = `
      <strong>${escapeHtml(category.name)}</strong>
      <span class="${chosen.length ? "selected" : ""}">
        ${chosen.length ? escapeHtml(chosen.join(", ")) : "Tap to choose"}
      </span>`;
    button.addEventListener("click", () => openCategory(category.id));
    categoryList.appendChild(button);
  });
  saveState();
}

function openCategory(categoryId) {
  activeCategoryId = categoryId;
  const category = state.categories.find(c => c.id === categoryId);
  if (!category) return;
  $("#categoryDialogTitle").textContent = category.name;
  const list = $("#itemChoiceList");
  list.innerHTML = "";

  if (!category.items.length) {
    list.innerHTML = `<p class="empty">No items yet. Choose “Edit items” to add one.</p>`;
  } else {
    category.items.forEach(item => {
      const label = document.createElement("label");
      label.className = "choice-row";
      const checked = (state.selections[category.id] || []).includes(item);
      label.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""}> <span>${escapeHtml(item)}</span>`;
      label.querySelector("input").addEventListener("change", (event) => {
        const existing = new Set(state.selections[category.id] || []);
        event.target.checked ? existing.add(item) : existing.delete(item);
        state.selections[category.id] = [...existing];
        render();
      });
      list.appendChild(label);
    });
  }
  categoryDialog.showModal();
}

$("#manageItemsBtn").addEventListener("click", () => {
  categoryDialog.close();
  openManageItems(activeCategoryId);
});

function openManageCategories() {
  manageMode = "categories";
  $("#manageDialogTitle").textContent = "Manage categories";
  $("#addManagedItemBtn").textContent = "+ Add category";
  renderManageList();
  manageDialog.showModal();
}

function openManageItems(categoryId) {
  activeCategoryId = categoryId;
  manageMode = "items";
  const category = state.categories.find(c => c.id === categoryId);
  $("#manageDialogTitle").textContent = `Edit ${category?.name || "items"}`;
  $("#addManagedItemBtn").textContent = "+ Add item";
  renderManageList();
  manageDialog.showModal();
}

function renderManageList() {
  const list = $("#manageList");
  list.innerHTML = "";

  if (manageMode === "categories") {
    if (!state.categories.length) list.innerHTML = `<p class="empty">No categories yet.</p>`;
    state.categories.forEach((category, index) => {
      list.appendChild(makeManageRow(
        category.name,
        () => renameCategory(category.id),
        () => deleteCategory(category.id),
        () => moveCategory(index, -1),
        () => moveCategory(index, 1),
        index === 0,
        index === state.categories.length - 1
      ));
    });
  } else {
    const category = state.categories.find(c => c.id === activeCategoryId);
    if (!category?.items.length) list.innerHTML = `<p class="empty">No items yet.</p>`;
    category?.items.forEach((item, index) => {
      list.appendChild(makeManageRow(
        item,
        () => renameItem(category.id, item),
        () => deleteItem(category.id, item),
        () => moveItem(category.id, index, -1),
        () => moveItem(category.id, index, 1),
        index === 0,
        index === category.items.length - 1
      ));
    });
  }
}

function makeManageRow(text, editFn, deleteFn, upFn, downFn, first, last) {
  const row = document.createElement("div");
  row.className = "manage-row";
  row.innerHTML = `<span>${escapeHtml(text)}</span><div class="actions"></div>`;
  const actions = row.querySelector(".actions");
  [
    ["↑", upFn, first, "Move up"],
    ["↓", downFn, last, "Move down"],
    ["Edit", editFn, false, "Edit"],
    ["Delete", deleteFn, false, "Delete"]
  ].forEach(([label, fn, disabled, title]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mini ${label === "Delete" ? "danger" : ""}`;
    button.textContent = label;
    button.disabled = disabled;
    button.title = title;
    button.addEventListener("click", fn);
    actions.appendChild(button);
  });
  return row;
}

$("#addManagedItemBtn").addEventListener("click", async () => {
  if (manageMode === "categories") {
    const name = await askText("Add category", "Category name");
    if (!name) return;
    state.categories.push({ id: makeId("category"), name, items: [] });
  } else {
    const category = state.categories.find(c => c.id === activeCategoryId);
    const name = await askText("Add item", "Item name");
    if (!name || !category) return;
    if (category.items.some(i => i.toLowerCase() === name.toLowerCase())) {
      alert("That item already exists in this category.");
      return;
    }
    category.items.push(name);
  }
  renderManageList();
  render();
});

async function renameCategory(id) {
  const category = state.categories.find(c => c.id === id);
  const name = await askText("Rename category", "Category name", category?.name || "");
  if (!name || !category) return;
  category.name = name;
  renderManageList(); render();
}

function deleteCategory(id) {
  const category = state.categories.find(c => c.id === id);
  if (!category || !confirm(`Delete “${category.name}” and all its items?`)) return;
  state.categories = state.categories.filter(c => c.id !== id);
  delete state.selections[id];
  state.savedMeals.forEach(meal => delete meal.selections[id]);
  renderManageList(); render();
}

function moveCategory(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= state.categories.length) return;
  [state.categories[index], state.categories[target]] = [state.categories[target], state.categories[index]];
  renderManageList(); render();
}

async function renameItem(categoryId, oldName) {
  const category = state.categories.find(c => c.id === categoryId);
  const name = await askText("Rename item", "Item name", oldName);
  if (!name || !category) return;
  if (category.items.some(i => i !== oldName && i.toLowerCase() === name.toLowerCase())) {
    alert("That item already exists in this category.");
    return;
  }
  const index = category.items.indexOf(oldName);
  category.items[index] = name;
  state.selections[categoryId] = (state.selections[categoryId] || []).map(i => i === oldName ? name : i);
  state.savedMeals.forEach(meal => {
    meal.selections[categoryId] = (meal.selections[categoryId] || []).map(i => i === oldName ? name : i);
  });
  renderManageList(); render();
}

function deleteItem(categoryId, item) {
  const category = state.categories.find(c => c.id === categoryId);
  if (!category || !confirm(`Delete “${item}”?`)) return;
  category.items = category.items.filter(i => i !== item);
  state.selections[categoryId] = (state.selections[categoryId] || []).filter(i => i !== item);
  state.savedMeals.forEach(meal => {
    meal.selections[categoryId] = (meal.selections[categoryId] || []).filter(i => i !== item);
  });
  renderManageList(); render();
}

function moveItem(categoryId, index, delta) {
  const category = state.categories.find(c => c.id === categoryId);
  if (!category) return;
  const target = index + delta;
  if (target < 0 || target >= category.items.length) return;
  [category.items[index], category.items[target]] = [category.items[target], category.items[index]];
  renderManageList(); render();
}

$("#saveMealBtn").addEventListener("click", async () => {
  const text = fullMealText();
  if (!text) {
    alert("Choose at least one item before saving.");
    return;
  }
  const name = await askText("Save combination", "Combination name", text);
  if (!name) return;
  state.savedMeals.push({
    id: makeId("meal"),
    name,
    selections: structuredClone(state.selections)
  });
  render();
});

$("#savedMealsBtn").addEventListener("click", () => {
  renderSavedMeals();
  savedDialog.showModal();
});

function renderSavedMeals() {
  const list = $("#savedMealList");
  list.innerHTML = "";
  if (!state.savedMeals.length) {
    list.innerHTML = `<p class="empty">No saved combinations yet.</p>`;
    return;
  }
  state.savedMeals.forEach(meal => {
    const row = document.createElement("div");
    row.className = "saved-row";
    row.innerHTML = `
      <button type="button" class="load">
        <span><strong>${escapeHtml(meal.name)}</strong>
        <small>${escapeHtml(fullMealText(meal.selections) || "No remaining items")}</small></span>
      </button>
      <div class="actions"></div>`;
    row.querySelector(".load").addEventListener("click", () => {
      state.selections = structuredClone(meal.selections);
      savedDialog.close();
      render();
    });
    const actions = row.querySelector(".actions");
    const rename = document.createElement("button");
    rename.type = "button"; rename.className = "mini"; rename.textContent = "Edit";
    rename.addEventListener("click", async () => {
      const name = await askText("Rename combination", "Combination name", meal.name);
      if (!name) return;
      meal.name = name; renderSavedMeals(); render();
    });
    const del = document.createElement("button");
    del.type = "button"; del.className = "mini danger"; del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm(`Delete “${meal.name}”?`)) return;
      state.savedMeals = state.savedMeals.filter(m => m.id !== meal.id);
      renderSavedMeals(); render();
    });
    actions.append(rename, del);
    list.appendChild(row);
  });
}

$("#clearMealBtn").addEventListener("click", () => {
  if (!fullMealText() || confirm("Clear the current combination?")) {
    state.selections = {};
    render();
  }
});

$("#manageCategoriesBtn").addEventListener("click", openManageCategories);
$("#addCategoryBtn").addEventListener("click", openManageCategories);

$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meal-builder-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$("#importInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported.categories) || typeof imported.selections !== "object" || !Array.isArray(imported.savedMeals)) {
      throw new Error("Invalid format");
    }
    if (!confirm("Replace the current app data with this backup?")) return;
    state = imported;
    render();
    alert("Backup restored.");
  } catch {
    alert("That file is not a valid Meal Builder backup.");
  } finally {
    event.target.value = "";
  }
});

function askText(title, label, value = "") {
  return new Promise(resolve => {
    promptResolver = resolve;
    $("#promptTitle").textContent = title;
    $("#promptLabel").textContent = label;
    $("#promptInput").value = value;
    promptDialog.showModal();
    setTimeout(() => $("#promptInput").focus(), 30);
  });
}

$("#promptForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const submitter = event.submitter?.value;
  const value = $("#promptInput").value.trim();
  promptDialog.close();
  const resolve = promptResolver;
  promptResolver = null;
  resolve?.(submitter === "confirm" ? value : null);
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
