document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  
  // Auth elements
  const userBtn = document.getElementById("user-btn");
  const authModal = document.getElementById("auth-modal");
  const closeBtn = document.querySelector(".close-btn");
  const loginForm = document.getElementById("login-form");
  const logoutForm = document.getElementById("logout-form");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");
  const currentUsername = document.getElementById("current-username");
  const signupContainer = document.getElementById("signup-container");
  
  // Auth state
  let authToken = null;
  let currentTeacher = null;

  // Load auth state from sessionStorage
  function loadAuthState() {
    const saved = sessionStorage.getItem("authToken");
    const teacher = sessionStorage.getItem("currentTeacher");
    if (saved && teacher) {
      authToken = saved;
      currentTeacher = teacher;
      updateUIForAuth();
    }
  }

  // Handle user button click
  userBtn.addEventListener("click", () => {
    authModal.classList.remove("hidden");
  });

  // Handle close button
  closeBtn.addEventListener("click", () => {
    authModal.classList.add("hidden");
    loginError.classList.add("hidden");
  });

  // Handle login form submit
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch(
        `/auth/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );

      const result = await response.json();

      if (response.ok) {
        authToken = result.token;
        currentTeacher = result.username;
        
        // Save to sessionStorage
        sessionStorage.setItem("authToken", authToken);
        sessionStorage.setItem("currentTeacher", currentTeacher);
        
        // Update UI
        loginForm.reset();
        loginError.classList.add("hidden");
        updateUIForAuth();
        
        // Close modal after successful login
        setTimeout(() => {
          authModal.classList.add("hidden");
        }, 500);
      } else {
        loginError.textContent = result.detail || "Login failed";
        loginError.classList.remove("hidden");
      }
    } catch (error) {
      loginError.textContent = "Failed to login. Please try again.";
      loginError.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  // Handle logout
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: { "Authorization": authToken }
      });
      
      // Clear auth state
      authToken = null;
      currentTeacher = null;
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("currentTeacher");
      
      // Update UI
      updateUIForAuth();
      authModal.classList.add("hidden");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  });

  // Update UI based on authentication state
  function updateUIForAuth() {
    if (authToken && currentTeacher) {
      // Teacher is logged in
      loginForm.classList.add("hidden");
      logoutForm.classList.remove("hidden");
      currentUsername.textContent = currentTeacher;
      
      // Show signup section for teachers only
      signupContainer.classList.remove("hidden");
    } else {
      // Teacher is logged out (student view)
      loginForm.classList.remove("hidden");
      logoutForm.classList.add("hidden");
      loginForm.reset();
      
      // Hide signup section for non-teachers
      signupContainer.classList.add("hidden");
    }
    
    // Refresh activities to show/hide delete buttons
    fetchActivities();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML - only show delete buttons if teacher is logged in
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) => {
                      const deleteBtn = authToken && currentTeacher
                        ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                        : "";
                      return `<li><span class="participant-email">${email}</span>${deleteBtn}</li>`;
                    }
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown (for teachers)
        if (!activitySelect.querySelector(`option[value="${name}"]`)) {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          activitySelect.appendChild(option);
        }
      });

      // Add event listeners to delete buttons (only if teacher is logged in)
      if (authToken && currentTeacher) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": authToken
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "message success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "message error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "message error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "Authorization": authToken
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "message success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "message error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "message error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Close modal when clicking outside of it
  window.addEventListener("click", (event) => {
    if (event.target === authModal) {
      authModal.classList.add("hidden");
    }
  });

  // Initialize app
  loadAuthState();
  updateUIForAuth();
});
