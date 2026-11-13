
const API = "https://www.themealdb.com/api/json/v1/1";

const nigerianRecipes = [
  {
    idMeal: "NG001",
    strMeal: "Nigerian Jollof Rice",
    strCategory: "Nigerian",
    strArea: "Nigerian",
    strMealThumb: "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=700",
    ingredients: [
      "2 cups rice",
      "4 tomatoes",
      "2 red bell peppers",
      "2 scotch bonnet peppers",
      "1 onion",
      "2 tablespoons tomato paste",
      "Vegetable oil",
      "2 cups chicken stock",
      "Curry powder",
      "Thyme",
      "Seasoning cubes",
      "Salt to taste"
    ],
    strInstructions: `1. Wash and parboil the rice.

2. Blend the tomatoes, red bell peppers, scotch bonnet peppers, and onions.

3. Heat vegetable oil in a pot and fry the tomato paste briefly.

4. Add the blended pepper mixture and cook until it thickens and the raw tomato taste disappears.

5. Add chicken stock, curry powder, thyme, seasoning cubes, and salt.

6. Add the rice and stir until everything is well combined.

7. Cover and cook on low heat until the rice is tender.

8. Serve with fried plantain, chicken, or your favourite side.`
  },
  {
    idMeal: "NG002",
    strMeal: "Egusi Soup",
    strCategory: "Nigerian",
    strArea: "Nigerian",
    strMealThumb: "https://images.unsplash.com/photo-1547592180-85f173990554?w=700",
    ingredients: [
      "2 cups ground egusi",
      "Half cup palm oil",
      "500g assorted meat",
      "Stockfish",
      "2 handfuls ugu leaves",
      "1 onion",
      "Scotch bonnet pepper",
      "Ground crayfish",
      "Seasoning cubes",
      "Salt to taste"
    ],
    strInstructions: `1. Season and cook your assorted meat until tender. Keep the stock.

2. Heat palm oil in a pot and add chopped onions.

3. Add the ground egusi and stir. You can mix it with a little water first to form a paste.

4. Allow the egusi to cook, stirring occasionally.

5. Add meat stock gradually.

6. Add the cooked meat, stockfish, ground crayfish, pepper, and seasoning.

7. Add washed ugu leaves or bitterleaf.

8. Simmer until the vegetables are cooked.

9. Serve with pounded yam, eba, or fufu.`
  },
  {
    idMeal: "NG003",
    strMeal: "Efo Riro",
    strCategory: "Nigerian",
    strArea: "Nigerian",
    strMealThumb: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700",
    ingredients: [
      "3 handfuls spinach or ugu",
      "Half cup palm oil",
      "3 tomatoes",
      "2 red bell peppers",
      "300g assorted meat",
      "2 tablespoons ground crayfish",
      "1 onion",
      "Seasoning cubes",
      "Salt to taste"
    ],
    strInstructions: `1. Wash and slice the vegetables.

2. Season and cook assorted meat until tender.

3. Blend the tomatoes, red bell peppers, and scotch bonnet.

4. Heat palm oil in a pot and fry the onions.

5. Add the blended pepper mixture and cook until the sauce thickens.

6. Add the cooked meat, crayfish, stock, and seasoning.

7. Add the vegetables and stir.

8. Simmer briefly and serve with eba, amala, or another swallow.`
  },
  {
    idMeal: "NG004",
    strMeal: "Nigerian Moi Moi",
    strCategory: "Nigerian",
    strArea: "Nigerian",
    strMealThumb: "https://images.unsplash.com/photo-1547592180-85f173990554?w=700",
    ingredients: [
      "2 cups black-eyed beans",
      "2 red bell peppers",
      "1 onion",
      "Quarter cup vegetable oil",
      "Seasoning cubes",
      "Salt",
      "Boiled eggs (optional)"
    ],
    strInstructions: `1. Soak the beans and remove their outer skins.

2. Blend the beans with pepper, onions, and enough water to create a smooth mixture.

3. Pour into a bowl and add vegetable oil, seasoning, and salt.

4. Mix thoroughly until everything is combined.

5. Pour the mixture into heat-safe containers. Add boiled egg if desired.

6. Arrange the containers in a pot with a little water.

7. Cover and steam until the moi moi is firm and fully cooked.

8. Allow it to cool slightly before serving.`
  },
  {
    idMeal: "NG005",
    strMeal: "Nigerian Pepper Soup",
    strCategory: "Nigerian",
    strArea: "Nigerian",
    strMealThumb: "https://images.unsplash.com/photo-1547592180-85f173990554?w=700",
    ingredients: [
      "500g goat meat or fish",
      "2 tablespoons pepper soup spice",
      "2 scotch bonnet peppers",
      "1 onion",
      "1 tablespoon ground crayfish",
      "Scent leaves",
      "Seasoning cubes",
      "Salt to taste"
    ],
    strInstructions: `1. Wash and season the goat meat or fish.

2. Place in a pot with chopped onions and water.

3. Add pepper soup spice, ground crayfish, and seasoning.

4. Add fresh pepper and allow it to cook.

5. Continue cooking until the meat is tender and the broth is flavourful.

6. Add scent leaves and simmer for a few minutes.

7. Taste and adjust the seasoning.

8. Serve hot.`
  },
  {
    idMeal: "NG006",
    strMeal: "Amala and Ewedu",
    strCategory: "Nigerian",
    strArea: "Nigerian",
    strMealThumb: "https://images.unsplash.com/photo-1547592180-85f173990554?w=700",
    ingredients: [
      "Yam flour",
      "Fresh ewedu leaves",
      "Locust beans",
      "Ground crayfish",
      "Seasoning cubes",
      "Salt",
      "Water",
      "Stew or gbegiri for serving"
    ],
    strInstructions: `To prepare the amala:

1. Bring water to a boil in a pot.

2. Gradually add yam flour while stirring continuously.

3. Stir until smooth and firm, adding a little water if necessary.

To prepare the ewedu:

4. Wash the ewedu leaves and remove the stems.

5. Cook the leaves in a little water until soft.

6. Blend or beat until the desired texture is reached.

7. Add locust beans, crayfish, and seasoning.

8. Serve the amala with ewedu and your choice of stew or gbegiri.`
  },
  {
    idMeal: "NG007",
    strMeal: "Nigerian Akara",
    strCategory: "Nigerian",
    strArea: "Nigerian",
    strMealThumb: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=700",
    ingredients: [
      "2 cups peeled beans",
      "1 onion",
      "2 scotch bonnet peppers",
      "Salt to taste",
      "Vegetable oil for frying"
    ],
    strInstructions: `1. Soak the beans and remove the skins.

2. Blend the beans with a little water until smooth and thick.

3. Finely chop or blend the onion and pepper.

4. Mix them into the bean paste with salt.

5. Beat the mixture to incorporate air and make it lighter.

6. Heat vegetable oil in a deep frying pan.

7. Scoop small portions of the mixture into the hot oil.

8. Fry until golden brown on both sides.

9. Serve with pap, bread, or custard.`
  },
  {
    idMeal: "NG008",
    strMeal: "Nigerian Yam Porridge",
    strCategory: "Nigerian",
    strArea: "Nigerian",
    strMealThumb: "https://images.unsplash.com/photo-1547592180-85f173990554?w=700",
    ingredients: [
      "1 medium yam",
      "Palm oil",
      "2 tomatoes",
      "1 onion",
      "Scotch bonnet pepper",
      "Ground crayfish",
      "Seasoning cubes",
      "Spinach or ugu",
      "Salt to taste"
    ],
    strInstructions: `1. Peel and cut the yam into medium-sized cubes.

2. Wash the yam and place it in a pot.

3. Add chopped onions, tomatoes, pepper, seasoning, and enough water to cook.

4. Cover and cook until the yam begins to soften.

5. Add palm oil and ground crayfish.

6. Stir gently and allow the yam to cook completely.

7. Mash a few pieces of yam to thicken the porridge.

8. Add spinach or ugu and simmer briefly.

9. Serve warm.`
  },
  {
    idMeal: "NG009",
    strMeal: "Suya",
    strCategory: "Nigerian",
    strArea: "Nigerian",
    strMealThumb: "https://images.unsplash.com/photo-1544025162-d76694265947?w=700",
    ingredients: [
      "500g thinly sliced beef",
      "Yaji (suya spice)",
      "Groundnut oil",
      "Salt",
      "Sliced onions",
      "Fresh tomatoes",
      "Fresh cabbage"
    ],
    strInstructions: `1. Slice the beef into thin strips.

2. Mix the yaji spice with a little groundnut oil and salt.

3. Coat the beef thoroughly with the spice mixture.

4. Thread the beef onto skewers.

5. Grill over medium heat, turning regularly until cooked through and slightly charred.

6. Serve with sliced onions, tomatoes, and cabbage.

Make sure the beef is fully cooked before serving.`
  },
  {
    idMeal: "NG010",
    strMeal: "Puff Puff",
    strCategory: "Nigerian",
    strArea: "Nigerian",
    strMealThumb: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=700",
    ingredients: [
      "3 cups flour",
      "Half cup sugar",
      "2 teaspoons instant yeast",
      "1 teaspoon salt",
      "Warm water",
      "Vegetable oil for frying"
    ],
    strInstructions: `1. Combine flour, sugar, yeast, and salt in a bowl.

2. Gradually add warm water and mix into a thick, smooth batter.

3. Cover the bowl and leave in a warm place until the batter rises.

4. Heat vegetable oil in a deep pot.

5. Scoop small portions of batter into the hot oil.

6. Fry, turning regularly, until golden brown.

7. Remove and drain on kitchen paper.

8. Allow to cool slightly before serving.`
  }
];

const recipeGrid = document.getElementById("recipeGrid");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const categoryList = document.getElementById("categoryList");
const sectionTitle = document.getElementById("sectionTitle");
const sectionDescription = document.getElementById("sectionDescription");
const resultsCount = document.getElementById("resultsCount");
const loadingText = document.getElementById("loadingText");
const emptyState = document.getElementById("emptyState");

const recipeModal = document.getElementById("recipeModal");
const closeModal = document.getElementById("closeModal");

const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalCategory = document.getElementById("modalCategory");
const ingredientsList = document.getElementById("ingredientsList");
const instructions = document.getElementById("instructions");
const modalFavourite = document.getElementById("modalFavourite");
const youtubeLink = document.getElementById("youtubeLink");

const navFavouriteCount = document.getElementById("navFavouriteCount");

let currentCategory = "All";
let currentSearch = "";
let currentRecipes = [];
let currentRecipe = null;
let favouriteIds = JSON.parse(localStorage.getItem("gather-favourites")) || [];
let allApiRecipes = [];

// Helpers

function isNigerianRecipe(recipe) {
  return String(recipe.idMeal).startsWith("NG");
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function getRecipeIngredients(recipe) {
  if (Array.isArray(recipe.ingredients)) {
    return recipe.ingredients;
  }

  const ingredients = [];

  for (let i = 1; i <= 20; i++) {
    const ingredient = recipe[`strIngredient${i}`]?.trim();
    const measure = recipe[`strMeasure${i}`]?.trim();

    if (ingredient) {
      ingredients.push(`${measure ? measure + " " : ""}${ingredient}`);
    }
  }

  return ingredients;
}

function saveFavourites() {
  localStorage.setItem("gather-favourites", JSON.stringify(favouriteIds));
  updateFavouriteCount();
}

function updateFavouriteCount() {
  navFavouriteCount.textContent = favouriteIds.length;
}

function isFavourite(id) {
  return favouriteIds.includes(String(id));
}

function toggleFavourite(id) {
  id = String(id);

  if (isFavourite(id)) {
    favouriteIds = favouriteIds.filter(item => item !== id);
  } else {
    favouriteIds.push(id);
  }

  saveFavourites();

  if (currentRecipe && String(currentRecipe.idMeal) === id) {
    updateModalFavourite();
  }

  renderRecipes(currentRecipes);
}

// Recipe card rendering

function createRecipeCard(recipe) {
  const saved = isFavourite(recipe.idMeal);

  return `
    <article class="recipe-card">
      <div class="card-image">
        <img
          src="${escapeHTML(recipe.strMealThumb || "")}"
          alt="${escapeHTML(recipe.strMeal)}"
          loading="lazy"
          onerror="this.src='https://placehold.co/700x450/f0ece3/777?text=Recipe'"
        >

        <button
          class="favourite-btn ${saved ? "saved" : ""}"
          data-favourite="${escapeHTML(recipe.idMeal)}"
          aria-label="${saved ? "Remove from" : "Add to"} favourites"
        >
          <i class="${saved ? "fa-solid" : "fa-regular"} fa-heart"></i>
        </button>
      </div>

      <div class="card-content">
        <p class="card-category">${escapeHTML(recipe.strCategory || "Recipe")}</p>
        <h3>${escapeHTML(recipe.strMeal)}</h3>

        <button class="view-recipe" data-view="${escapeHTML(recipe.idMeal)}">
          View recipe <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    </article>
  `;
}

function renderRecipes(recipes) {
  currentRecipes = recipes;

  recipeGrid.innerHTML = recipes.map(createRecipeCard).join("");

  resultsCount.textContent = `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"} found`;

  emptyState.hidden = recipes.length !== 0;
  recipeGrid.hidden = recipes.length === 0;
}

// API functions

async function fetchApiRecipes(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Could not connect to the recipe service.");
  }

  const data = await response.json();
  return data.meals || [];
}

async function getInitialRecipes() {
  try {
    loadingText.textContent = "Loading recipes...";

    const apiRecipes = await fetchApiRecipes(`${API}/search.php?f=b`);
    allApiRecipes = apiRecipes;

    const combined = [...nigerianRecipes, ...apiRecipes];

    sectionTitle.textContent = "Explore recipes";
    sectionDescription.textContent = "A little inspiration for your next meal.";

    renderRecipes(combined);
  } catch (error) {
    console.error(error);
    sectionTitle.textContent = "Explore recipes";
    sectionDescription.textContent = "Enjoy our collection of Nigerian dishes.";

    renderRecipes(nigerianRecipes);
  } finally {
    loadingText.textContent = "";
  }
}

// Category filtering

async function filterCategory(category) {
  currentCategory = category;
  currentSearch = "";
  searchInput.value = "";

  document.querySelectorAll(".category-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.category === category
    );
  });

  loadingText.textContent = "Finding recipes...";

  if (category === "Nigerian") {
    sectionTitle.textContent = "Nigerian favourites";
    sectionDescription.textContent = "Traditional dishes and flavours from home.";

    renderRecipes(nigerianRecipes);
    loadingText.textContent = "";
    return;
  }

  if (category === "All") {
    sectionTitle.textContent = "Explore recipes";
    sectionDescription.textContent = "A little inspiration for your next meal.";

    await getInitialRecipes();
    return;
  }

  sectionTitle.textContent = `${category} recipes`;
  sectionDescription.textContent = `Discover delicious ${category.toLowerCase()} dishes.`;

  try {
    const apiRecipes = await fetchApiRecipes(
      `${API}/filter.php?c=${encodeURIComponent(category)}`
    );

    renderRecipes(apiRecipes);
  } catch (error) {
    console.error(error);
    renderRecipes([]);
    loadingText.textContent = "Could not load recipes. Please try again.";
  } finally {
    if (loadingText.textContent === "Finding recipes...") {
      loadingText.textContent = "";
    }
  }
}

// Search

async function searchRecipes(query) {
  currentSearch = query.trim();
  currentCategory = "Search";

  document.querySelectorAll(".category-btn").forEach(button => {
    button.classList.remove("active");
  });

  if (!currentSearch) {
    filterCategory("All");
    return;
  }

  sectionTitle.textContent = "Search results";
  sectionDescription.textContent = `Showing recipes for "${currentSearch}".`;

  loadingText.textContent = "Searching...";

  const localResults = nigerianRecipes.filter(recipe => {
    const searchableText = [
      recipe.strMeal,
      recipe.strCategory,
      ...getRecipeIngredients(recipe)
    ].join(" ").toLowerCase();

    return searchableText.includes(currentSearch.toLowerCase());
  });

  try {
    const apiResults = await fetchApiRecipes(
      `${API}/search.php?s=${encodeURIComponent(currentSearch)}`
    );

    const combined = [...localResults, ...apiResults];

    const unique = [
      ...new Map(combined.map(recipe => [recipe.idMeal, recipe])).values()
    ];

    renderRecipes(unique);
  } catch (error) {
    console.error(error);
    renderRecipes(localResults);
  } finally {
    loadingText.textContent = "";
  }
}

// Recipe details

async function getRecipeDetails(id) {
  if (String(id).startsWith("NG")) {
    return nigerianRecipes.find(recipe => recipe.idMeal === id);
  }

  const meals = await fetchApiRecipes(`${API}/lookup.php?i=${id}`);
  return meals[0] || null;
}

async function openRecipe(id) {
  try {
    const recipe = await getRecipeDetails(id);

    if (!recipe) {
      alert("Sorry, we could not find this recipe.");
      return;
    }

    currentRecipe = recipe;

    modalImage.src = recipe.strMealThumb || "";
    modalImage.alt = recipe.strMeal || "Recipe image";
    modalTitle.textContent = recipe.strMeal || "Recipe";
    modalCategory.textContent = recipe.strCategory || "RECIPE";

    ingredientsList.innerHTML = getRecipeIngredients(recipe)
      .map(item => `<li>${escapeHTML(item)}</li>`)
      .join("");

    instructions.textContent =
      recipe.strInstructions || "No cooking instructions are available.";

    if (recipe.strYoutube) {
      youtubeLink.href = recipe.strYoutube;
      youtubeLink.hidden = false;
    } else {
      youtubeLink.hidden = true;
      youtubeLink.removeAttribute("href");
    }

    updateModalFavourite();

    recipeModal.classList.add("show");
    recipeModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  } catch (error) {
    console.error(error);
    alert("Something went wrong while loading this recipe.");
  }
}

function updateModalFavourite() {
  if (!currentRecipe) return;

  const saved = isFavourite(currentRecipe.idMeal);

  modalFavourite.classList.toggle("saved", saved);
  modalFavourite.innerHTML = `
    <i class="${saved ? "fa-solid" : "fa-regular"} fa-heart"></i>
    ${saved ? "Saved to collection" : "Save recipe"}
  `;
}

function closeRecipeModal() {
  recipeModal.classList.remove("show");
  recipeModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  currentRecipe = null;
}

// Favourites collection

async function showFavourites() {
  currentCategory = "Favourites";
  currentSearch = "";

  sectionTitle.textContent = "My collection";
  sectionDescription.textContent = "The recipes you've saved for later.";

  document.querySelectorAll(".category-btn").forEach(button => {
    button.classList.remove("active");
  });

  loadingText.textContent = "Loading your collection...";

  try {
    const savedRecipes = await Promise.all(
      favouriteIds.map(async id => {
        if (String(id).startsWith("NG")) {
          return nigerianRecipes.find(recipe => recipe.idMeal === id);
        }

        return getRecipeDetails(id);
      })
    );

    renderRecipes(savedRecipes.filter(Boolean));
  } catch (error) {
    console.error(error);
    renderRecipes(
      nigerianRecipes.filter(recipe => isFavourite(recipe.idMeal))
    );
  } finally {
    loadingText.textContent = "";
  }
}

// Event listeners

searchForm.addEventListener("submit", event => {
  event.preventDefault();
  searchRecipes(searchInput.value);
});

categoryList.addEventListener("click", event => {
  const button = event.target.closest(".category-btn");

  if (!button) return;

  filterCategory(button.dataset.category);
});

recipeGrid.addEventListener("click", event => {
  const favouriteButton = event.target.closest("[data-favourite]");
  const viewButton = event.target.closest("[data-view]");

  if (favouriteButton) {
    toggleFavourite(favouriteButton.dataset.favourite);

    if (currentCategory === "Favourites") {
      showFavourites();
    }

    return;
  }

  if (viewButton) {
    openRecipe(viewButton.dataset.view);
  }
});

modalFavourite.addEventListener("click", () => {
  if (!currentRecipe) return;

  toggleFavourite(currentRecipe.idMeal);
});

closeModal.addEventListener("click", closeRecipeModal);

recipeModal.addEventListener("click", event => {
  if (event.target === recipeModal) {
    closeRecipeModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeRecipeModal();
  }
});

document.getElementById("collectionLink").addEventListener("click", () => {
  showFavourites();
  document.getElementById("recipes").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("exploreNigerian").addEventListener("click", () => {
  filterCategory("Nigerian");
  document.getElementById("recipes").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("clearFilter").addEventListener("click", () => {
  filterCategory("All");
});

document.getElementById("mobileMenu").addEventListener("click", () => {
  document.querySelector(".nav-links").classList.toggle("open");
});

// Close mobile navigation after selecting a link
document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelector(".nav-links").classList.remove("open");
  });
});

// Start the application
updateFavouriteCount();
getInitialRecipes();
