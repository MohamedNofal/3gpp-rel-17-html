document.addEventListener('DOMContentLoaded', () => {
    const docList = document.getElementById('doc-list');
    const tocContainer = document.getElementById('toc');
    const contentFrame = document.getElementById('content-frame');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const searchResultsList = document.getElementById('search-results');
    const welcomeMessage = document.getElementById('welcome-message');
    const mainLayout = document.querySelector('.main-layout');

    // Viewer controls
    const resizer = document.getElementById('resizer');
    const sidebarPanel = document.getElementById('sidebar-panel');
    const toggleSidebarsBtn = document.getElementById('toggle-sidebars');
    const widthSlider = document.getElementById('width-slider');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomLevelSpan = document.getElementById('zoom-level');
    const backToTopBtn = document.getElementById('back-to-top');

    let searchIndex;
    let searchData;
    let currentDocPath = null;
    let currentZoom = 1.0;

    // Load manifest and initialize
    async function init() {
        try {
            const response = await fetch('manifest.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const manifest = await response.json();
            renderDocList(manifest);
            
            const searchResponse = await fetch('search_data.json');
            if (!searchResponse.ok) throw new Error(`HTTP error! status: ${searchResponse.status}`);
            searchData = await searchResponse.json();
            
            searchIndex = lunr(function () {
                this.ref('id');
                this.field('title', { boost: 10 });
                this.field('body');
                this.field('doc_title');

                searchData.forEach(doc => {
                    this.add(doc);
                });
            });

            setupEventListeners();
            loadViewerSettings();

        } catch (error) {
            console.error("Failed to load initial data:", error);
            docList.innerHTML = '<li>Error loading documents list. Run build_index.py first.</li>';
        }
    }

    function renderDocList(manifest) {
        docList.innerHTML = '';
        manifest.forEach(spec => {
            if (spec.files.length === 0) return;
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
                applyViewerSettings();
                if (hash) {
                    const el = contentFrame.contentDocument.getElementById(hash);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }
                contentFrame.contentWindow.addEventListener('scroll', handleFrameScroll);
            };
        } else {
             if (hash) {
                const el = contentFrame.contentDocument.getElementById(hash);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
        }
        localStorage.setItem('lastDocument', path);
    }

    function extractToc() {
        tocContainer.innerHTML = '';
        const frameDoc = contentFrame.contentDocument;
        if (frameDoc) {
            const tocNav = frameDoc.getElementById('TOC');
            if (tocNav) {
                const clonedToc = tocNav.cloneNode(true);
                clonedToc.id = 'sidebar-toc';
                tocContainer.appendChild(clonedToc);
                
                clonedToc.querySelectorAll('a').forEach(a => {
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

    function handleSearch(event) {
        const query = event.target.value.trim();

        if (query.length < 3) {
            searchResultsList.innerHTML = '';
            searchResultsContainer.classList.add('hidden');
            if(currentDocPath) {
                contentFrame.classList.remove('hidden');
            } else {
                welcomeMessage.classList.remove('hidden');
            }
            return;
        }

        try {
            const results = searchIndex.search(query);
            renderSearchResults(results, query);
        } catch(e) {
            console.error("Search error:", e);
            searchResultsList.innerHTML = '<li>Search error. Please try a different query.</li>';
        }
    }
    
    function renderSearchResults(results, query) {
        searchResultsList.innerHTML = '';
        if (results.length === 0) {
            searchResultsList.innerHTML = `<li>No results found for "<strong>${query}</strong>".</li>`;
        } else {
            results.slice(0, 100).forEach(result => {
                const doc = searchData.find(d => d.id === result.ref);
                if (doc) {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = doc.path;
                    a.dataset.path = doc.path;
                    a.innerHTML = `
                        <span class="result-title">${doc.title}</span>
                        <span class="result-path">${doc.doc_path}</span>
                    `;
                    a.addEventListener('click', (e) => {
                        e.preventDefault();
                        loadDocument(doc.path);
                        const docLink = document.querySelector(`#doc-list a[data-path="${doc.doc_path}"]`);
                        if(docLink) {
                           setActiveLink(docList, docLink);
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
    
    function applyViewerSettings() {
        const width = widthSlider.value;
        const frameDoc = contentFrame.contentDocument;
        if (frameDoc && frameDoc.head) {
            let styleElement = frameDoc.getElementById('viewer-style');
            if (!styleElement) {
                styleElement = frameDoc.createElement('style');
                styleElement.id = 'viewer-style';
                frameDoc.head.appendChild(styleElement);
            }
            styleElement.textContent = `
                body { max-width: ${width}% !important; margin: 0 auto !important; }
                html { font-size: ${currentZoom * 100}% }
            `;
        }
        zoomLevelSpan.textContent = `${Math.round(currentZoom * 100)}%`;
    }
    
    function saveViewerSettings() {
        localStorage.setItem('viewerSettings', JSON.stringify({
            width: widthSlider.value,
            zoom: currentZoom,
            sidebarsVisible: !sidebarPanel.classList.contains('hidden'),
            sidebarWidth: sidebarPanel.style.flexBasis
        }));
    }

    function loadViewerSettings() {
        const settings = JSON.parse(localStorage.getItem('viewerSettings'));
        if (settings) {
            widthSlider.value = settings.width || 100;
            currentZoom = settings.zoom || 1.0;
            const sidebarsVisible = 'sidebarsVisible' in settings ? settings.sidebarsVisible : true;
            toggleSidebars(sidebarsVisible, true);
            sidebarPanel.style.flexBasis = settings.sidebarWidth || "600px";
        }
        applyViewerSettings();
        
        const lastDoc = localStorage.getItem('lastDocument');
        if (lastDoc) {
            loadDocument(lastDoc);
            const docLink = document.querySelector(`#doc-list a[data-path="${lastDoc}"]`);
            if (docLink) {
                setActiveLink(docList, docLink);
                docLink.closest('details').open = true;
            }
        }
    }

    function initResizer() {
        resizer.addEventListener('mousedown', function (e) {
            e.preventDefault();
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            const onMouseMove = (e) => {
                const newWidth = e.clientX;
                if (newWidth > 200 && newWidth < (window.innerWidth - 200)) {
                    sidebarPanel.style.flexBasis = newWidth + 'px';
                }
            };
            const onMouseUp = () => {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                saveViewerSettings();
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    function toggleSidebars(visible, force = false) {
        const isVisible = force ? visible : sidebarPanel.classList.contains('hidden');
        sidebarPanel.classList.toggle('hidden', !isVisible);
        resizer.classList.toggle('hidden', !isVisible);
        if(!force) saveViewerSettings();
    }

    function handleFrameScroll() {
        if (contentFrame.contentWindow.scrollY > 400) {
            backToTopBtn.classList.remove('hidden');
        } else {
            backToTopBtn.classList.add('hidden');
        }
    }

    function setupEventListeners() {
        searchInput.addEventListener('input', handleSearch);
        widthSlider.addEventListener('input', () => {
            applyViewerSettings();
            saveViewerSettings();
        });
        zoomInBtn.addEventListener('click', () => {
            currentZoom = Math.min(2.5, currentZoom + 0.1);
            applyViewerSettings();
            saveViewerSettings();
        });
        zoomOutBtn.addEventListener('click', () => {
            currentZoom = Math.max(0.5, currentZoom - 0.1);
            applyViewerSettings();
            saveViewerSettings();
        });
        toggleSidebarsBtn.addEventListener('click', () => toggleSidebars());
        backToTopBtn.addEventListener('click', () => {
            if (contentFrame.contentDocument) {
                contentFrame.contentDocument.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    init();
});