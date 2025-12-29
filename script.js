const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('results');
const errorMsg = document.getElementById('errorMsg');
const statsDiv = document.getElementById('stats');
const totalCountSpan = document.getElementById('totalCount');
const spinner = searchBtn.querySelector('.spinner');
const btnText = searchBtn.querySelector('span');

searchBtn.addEventListener('click', handleSearch);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});

async function handleSearch() {
    const rawInput = usernameInput.value.trim();
    if (!rawInput) return;

    // Reset UI
    resetUI();
    setLoading(true);

    const username = extractUsername(rawInput);
    if (!username) {
        showError('Invalid GitHub username or URL');
        setLoading(false);
        return;
    }

    try {
        const repos = await fetchAllRepos(username);
        const pagesRepos = repos.filter(repo => repo.has_pages);

        displayStats(pagesRepos.length);

        if (pagesRepos.length === 0) {
            showError(`No active GitHub Pages sites found for ${username}`);
        } else {
            // Sort by recently updated
            pagesRepos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            renderResults(username, pagesRepos);
        }

    } catch (error) {
        console.error(error);
        if (error.status === 404) {
            showError('User not found');
        } else if (error.status === 403) {
            showError('API rate limit exceeded. Please try again later.');
        } else {
            showError('An error occurred while fetching data. Please check your connection.');
        }
    } finally {
        setLoading(false);
    }
}

function extractUsername(input) {
    // Remove trailing slashes
    input = input.replace(/\/+$/, '');

    // Check if full URL
    try {
        const url = new URL(input);
        if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
            const pathParts = url.pathname.split('/').filter(p => p);
            return pathParts[0];
        }
    } catch (e) {
        // Not a URL, checking if valid username pattern
        // Simple regex for github username: alphanumeric and hyphens
        if (/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(input)) {
            return input;
        }
    }
    return null;
}

async function fetchAllRepos(username) {
    let allRepos = [];
    let page = 1;
    const perPage = 100;

    // Safety break loop
    while (true) {
        const response = await fetch(`https://api.github.com/users/${username}/repos?per_page=${perPage}&page=${page}&sort=updated`);

        if (!response.ok) {
            const err = new Error('Fetch failed');
            err.status = response.status;
            throw err;
        }

        const data = await response.json();
        allRepos = allRepos.concat(data);

        // If we got fewer than perPage, we've reached the end
        if (data.length < perPage) break;

        page++;
        // Limit to 500 repos to avoid hitting API hard on very large accounts
        if (allRepos.length >= 500) break;
    }

    return allRepos;
}

function renderResults(username, repos) {
    resultsContainer.innerHTML = '';

    repos.forEach((repo, index) => {
        const card = document.createElement('a');
        card.className = 'repo-card';
        card.style.animationDelay = `${index * 0.05}s`;

        // Construct Pages URL
        // If it's a User site (username.github.io), the url is just that.
        // Otherwise it's username.github.io/repo-name

        let pagesUrl;

        const isUserSite = repo.name.toLowerCase() === `${username.toLowerCase()}.github.io`;

        if (isUserSite) {
            pagesUrl = `https://${username}.github.io/`;
        } else {
            pagesUrl = `https://${username}.github.io/${repo.name}/`;
        }

        card.href = pagesUrl;
        card.target = "_blank";
        card.rel = "noopener noreferrer";

        card.innerHTML = `
            <div class="repo-header">
                <div class="repo-name">${repo.name}</div>
            </div>
            <p class="repo-desc">${repo.description || 'No description provided.'}</p>
            <div class="repo-footer">
                <span>Last updated: ${new Date(repo.updated_at).toLocaleDateString()}</span>
                <span class="view-link">
                    Visit Site 
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                </span>
            </div>
        `;

        resultsContainer.appendChild(card);
    });
}

function resetUI() {
    resultsContainer.innerHTML = '';
    errorMsg.classList.add('hidden');
    errorMsg.textContent = '';
    statsDiv.classList.add('hidden');
}

function setLoading(isLoading) {
    if (isLoading) {
        searchBtn.disabled = true;
        spinner.classList.remove('hidden');
        btnText.textContent = 'Checking...';
    } else {
        searchBtn.disabled = false;
        spinner.classList.add('hidden');
        btnText.textContent = 'Check Repositories';
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

function displayStats(count) {
    totalCountSpan.textContent = count;
    statsDiv.classList.remove('hidden');
}
