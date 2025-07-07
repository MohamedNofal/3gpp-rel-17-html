document.addEventListener('DOMContentLoaded', () => {
    const docList = document.getElementById('doc-list');
    const tocContainer = document.getElementById('toc');
    const contentFrame = document.getElementById('content-frame');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const searchResultsList = document.getElementById('search-results');
    const welcomeMessage = document.getElementById('welcome-message');

    let searchIndex;
    let searchData;
    let currentDocPath = null;

    // Load manifest and initialize
    async function init() {
        try {
            const response = await fetch('manifest.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const manifest = await response.json();
            renderDocList(manifest);
            
            // Pre-load search data
            const searchResponse = await fetch('search_data.json');
            if (!searchResponse.ok) throw new Error(`HTTP error! status: ${searchResponse.status}`);
            searchData = await searchResponse.json();
            
            // Build Lunr.js index
            searchIndex = lunr(function () {
                this.ref('id');
                this.field('title', { boost: 10 });
                this.field('body');
                this.field('doc_title');

                searchData.forEach(doc => {
                    this.add(doc);
                });
            });

        } catch (error) {
            console.error("Failed to load initial data:", error);
            docList.innerHTML = '<li>Error loading documents list. Run build_index.py first.</li>';
        }
    }

    // Render the list of documents
    function renderDocList(manifest) {
        docList.innerHTML = '';
        manifest.forEach(spec => {
            const details = document.createElement('details');
            details.className = 'spec-group';
            
            const summary = document.createElement('summary');
            summary.textContent = spec.title;
            details.appendChild(summary);

            const ul = document.createElement('ul');
            spec.files.forEach(file => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = file.path;
                a.textContent = file.title;
                a.dataset.path = file.path;
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadDocument(file.path);
                    setActiveLink(docList, a);
                });
                li.appendChild(a);
                ul.appendChild(li);
            });
            details.appendChild(ul);
            docList.appendChild(details);
        });
    }
    
    // Load a document into the iframe
    function loadDocument(path) {
        welcomeMessage.classList.add('hidden');
        searchResultsContainer.classList.add('hidden');
        contentFrame.classList.remove('hidden');

        const [filePath, hash] = path.split('#');

        if (currentDocPath !== filePath) {
            contentFrame.src = filePath;
            currentDocPath = filePath;
            contentFrame.onload = () => {
                extractToc();
                if (hash) {
                    const el = contentFrame.contentDocument.getElementById(hash);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }
            };
        } else {
             if (hash) {
                const el = contentFrame.contentDocument.getElementById(hash);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    // Extract and render Table of Contents
    function extractToc() {
        tocContainer.innerHTML = '';
        const frameDoc = contentFrame.contentDocument;
        if (frameDoc) {
            const tocNav = frameDoc.getElementById('TOC');
            if (tocNav) {
                const clonedToc = tocNav.cloneNode(true);
                clonedToc.id = 'sidebar-toc';
                tocContainer.appendChild(clonedToc);
                
                tocContainer.querySelectorAll('a').forEach(a => {
                    const href = a.getAttribute('href');
                    if (href && href.startsWith('#')) {
                        a.addEventListener('click', (e) => {
                            e.preventDefault();
                            const targetId = href.substring(1);
                            frameDoc.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
                            setActiveLink(tocContainer, a);
                        });
                    }
                });
            } else {
                tocContainer.innerHTML = '<p>No Table of Contents found in this document.</p>';
            }
        }
    }

    // Handle search input
    function handleSearch(event) {
        const query = event.target.value;

        if (query.length < 3) {
            searchResultsList.innerHTML = '';
            searchResultsContainer.classList.add('hidden');
            if(welcomeMessage.classList.contains('hidden')) {
                contentFrame.classList.remove('hidden');
            }
            return;
        }

        const results = searchIndex.search(query);
        renderSearchResults(results);
    }
    
    // Render search results
    function renderSearchResults(results) {
        searchResultsList.innerHTML = '';
        if (results.length === 0) {
            searchResultsList.innerHTML = '<li>No results found.</li>';
        } else {
            results.slice(0, 50).forEach(result => {
                const doc = searchData.find(d => d.id === result.ref);
                if (doc) {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = doc.path;
                    a.dataset.path = doc.path;
                    a.innerHTML = `
                        <span class="result-title">${doc.title}</span>
                        <span class="result-path">${doc.doc_title}</span>
                    `;
                    a.addEventListener('click', (e) => {
                        e.preventDefault();
                        loadDocument(doc.path);
                        const docLink = document.querySelector(`#doc-list a[data-path='${doc.doc_path}']`);
                        setActiveLink(docList, docLink);
                        if(docLink) {
                           docLink.closest('details').open = true;
                        }
                    });
                    li.appendChild(a);
                    searchResultsList.appendChild(li);
                }
            });
        }
        welcomeMessage.classList.add('hidden');
        contentFrame.classList.add('hidden');
        searchResultsContainer.classList.remove('hidden');
    }

    function setActiveLink(container, link) {
        container.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        if (link) {
            link.classList.add('active');
        }
    }

    searchInput.addEventListener('input', handleSearch);

    init();
});