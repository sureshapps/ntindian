$(document).ready(function () { 
    //all sites Listings
    initDataThumbsValues();
   
    initLazyLoad();
    initThumbVideoPreview('.thumb','.js-thumb-preview-btn');
    initSearchForm('#searchForm', '#searchInput');
    initTagStripSlider('.js-tagstrip-top');
    initTagStripSlider('.js-tagstrip-bottom');
    //eof sites Listings
 
    //this markup
    initSiteManifest();
    initRecommendedBlock();
    initTopLoggedPanel();
    initDropMenu();
    initHeaderScroll();
    initOpenSearch();
    initOpenMenu();
    // initOpenFilter();
    // initApplySort();

    initSmartSort("sortSelect", "preferredSort");
    initSmartSort("sortSelectCategories", "preferredSortCategories");
    initSmartSort("sortSelectSearch", "preferredSortSearch");
    initOpenFilter();
    //eof this markup

    initReportPageSendReportForm();

});
 
//all sites
function initDataThumbsValues() {
    function generateHash(input) {
        return new Promise(function(resolve) {
            if (!window.crypto || !window.crypto.subtle) {
                // console.warn("crypto.subtle disabled, use fallback.");
                resolve(null);
                return;
            }

            const encoder = new TextEncoder();
            const data = encoder.encode(input);
            window.crypto.subtle.digest('SHA-256', data).then(function(hashBuffer) {
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(function(byte) {
                    return byte.toString(16).padStart(2, '0');
                }).join('');
                resolve(hashHex);
            }).catch(function(err) {
                // console.warn("crypto.subtle.digest failed", err);
                resolve(null);
            });
        });
    }

    function generateFallbackHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function isDataExpired(data) {
        const tenMinutes = 10 * 60 * 1000;
        return Date.now() - data.timestamp > tenMinutes;
    }

    function safeGetItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {}
    }

    function safeRemoveItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {}
    }

    function safeGetKeys(prefix) {
        try {
            return Object.keys(localStorage).filter(k => k.startsWith(prefix));
        } catch (e) {
            return [];
        }
    }

    const wrapper = document.querySelector('.wrapper');
    if (wrapper && wrapper.classList.contains('wrapper-video-page')) {
        const queryId = window.query_id;

        if (queryId) {
            let latestData = null;
            let latestTimestamp = 0;

            const keys = safeGetKeys("dataViews:");
            keys.forEach(function(key) {
                const storedData = safeGetItem(key);
                if (storedData) {
                    let parsedData;
                    try {
                        parsedData = JSON.parse(storedData);
                    } catch (e) {
                        return;
                    }

                    if (parsedData.timestamp > latestTimestamp && parsedData.thumbIds && parsedData.thumbIds.includes(queryId)) {
                        latestData = parsedData;
                        latestTimestamp = parsedData.timestamp;
                    }
                }
            });

            if (latestData) {
                $.ajax({
                    url: "https://api." + domain_name + "/stats/",
                    method: "POST",
                    contentType: "application/json",
                    data: JSON.stringify({
                        viewsId2Pos: latestData.thumbIds.reduce(function(acc, id, index) {
                            acc[String(id)] = index + 1;
                            return acc;
                        }, {}),
                        video_id: String(queryId),
                        country: String(latestData.country || window.country_code),
                        ref_query_id: String(latestData.refQueryId),
                        domain: String(latestData.domain || window.domain_name),
                        referrer: String(latestData.originalUrl)
                    }),
                    error: function() {
                        // console.log("error initDataThumbsValues");
                    }
                });
            }
        }
    }

    const storedKeys = safeGetKeys("dataViews:");
    storedKeys.forEach(function(key) {
        const storedData = safeGetItem(key);
        if (storedData) {
            let parsedData;
            try {
                parsedData = JSON.parse(storedData);
            } catch (e) {
                return;
            }

            if (isDataExpired(parsedData)) {
                safeRemoveItem(key);
            }
        }
    });

    const currentUrl = window.location.href;

    generateHash(currentUrl).then(function(hash) {
        const localStorageKey = "dataViews:" + (hash || generateFallbackHash(currentUrl));

        const existingDataRaw = safeGetItem(localStorageKey);
        let shouldDataUpdate = true;

        if (existingDataRaw) {
            let parsedData;
            try {
                parsedData = JSON.parse(existingDataRaw);
            } catch (e) {
                parsedData = null;
            }

            if (parsedData && !isDataExpired(parsedData)) {
                shouldDataUpdate = false;
            }
        }

        if (!window.useStats) return;

        if (shouldDataUpdate) {
            const thumbIds = [];

            $(".thumbs-wrapper.thumb-body .thumb").each(function() {
                const thumbId = $(this).data("gid");
                if (thumbId) {
                    thumbIds.push(thumbId);
                }
            });

            const storageData = {
                timestamp: Date.now(),
                originalUrl: currentUrl,
                country: window.country_code,
                refQueryId: window.query_id,
                domain: window.domain_name,
                thumbIds: thumbIds
            };

            safeSetItem(localStorageKey, JSON.stringify(storageData));

            const allKeys = safeGetKeys("dataViews:");
            if (allKeys.length > 20) {
                const oldestKey = allKeys.sort((a, b) => {
                    let aData = { timestamp: 0 }, bData = { timestamp: 0 };
                    try {
                        aData = JSON.parse(safeGetItem(a)) || aData;
                        bData = JSON.parse(safeGetItem(b)) || bData;
                    } catch (e) {}
                    return aData.timestamp - bData.timestamp;
                })[0];
                safeRemoveItem(oldestKey);
            }
        }
    });
}

//thumbs
let $currentActiveThumb = null;
function initThumbVideoPreview(thumbEl, initEl) {
    $(document).off("click", initEl);
    
    $(document).on("click", initEl, function (e) {
        e.preventDefault();

        const $button = $(this);
        const $thumb = $button.closest(thumbEl);

        if ($currentActiveThumb && !$thumb.is($currentActiveThumb)) {
            stopVideoPreview($currentActiveThumb);
        }

        if ($thumb.is($currentActiveThumb)) {
            stopVideoPreview($thumb);
            return;
        }

        startVideoPreview($thumb);
    });

    function startVideoPreview($thumb) {
        const $imgWrap = $thumb.find(".img-wrap");
        const $img = $imgWrap.find("img");
        const previewSrc = $img.attr("data-preview");
        const $button = $thumb.find(initEl);

        if (!previewSrc) return;

        const $video = $(`
            <video
                class="thumb-preview-video"
                autoplay
                muted
                loop
                playsinline
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 10;"
            >
                <source src="${previewSrc}" type="video/mp4">
            </video>
        `);

        $img.css("visibility", "hidden");
        $imgWrap.append($video);
        $button.hide(); 

        $currentActiveThumb = $thumb;
    }

    function stopVideoPreview($thumb) {
        $thumb.find(".thumb-preview-video").each(function () {
            this.pause();
            $(this).remove();
        });

        $thumb.find("img").css("visibility", "visible");
        $thumb.find(initEl).show(); 

        if ($currentActiveThumb && $thumb.is($currentActiveThumb)) {
            $currentActiveThumb = null;
        }
    }
}

function initLazyLoad() {
    (function (o, q) {
        "use strict";
        function s(f) {
            (this.time = f.time), (this.target = f.target), (this.rootBounds = f.rootBounds), (this.boundingClientRect = f.boundingClientRect), (this.intersectionRect = f.intersectionRect || g()), (this.isIntersecting = !!f.intersectionRect);
            var j = this.boundingClientRect,
                b = j.width * j.height,
                c = this.intersectionRect,
                d = c.width * c.height;
            this.intersectionRatio = b ? +(d / b).toFixed(4) : this.isIntersecting ? 1 : 0;
        }
        function b(e, f) {
            var b = f || {};
            if ("function" != typeof e) throw new Error("callback must be a function");
            if (b.root && 1 != b.root.nodeType) throw new Error("root must be an Element");
            (this._checkForIntersections = d(this._checkForIntersections.bind(this), this.THROTTLE_TIMEOUT)),
                (this._callback = e),
                (this._observationTargets = []),
                (this._queuedEntries = []),
                (this._rootMarginValues = this._parseRootMargin(b.rootMargin)),
                (this.thresholds = this._initThresholds(b.threshold)),
                (this.root = b.root || null),
                (this.rootMargin = this._rootMarginValues
                    .map(function (b) {
                        return b.value + b.unit;
                    })
                    .join(" "));
        }
        function c() {
            return o.performance && performance.now && performance.now();
        }
        function d(d, e) {
            var b = null;
            return function () {
                b ||
                    (b = setTimeout(function () {
                        d(), (b = null);
                    }, e));
            };
        }
        function e(e, f, b, c) {
            "function" == typeof e.addEventListener ? e.addEventListener(f, b, c || !1) : "function" == typeof e.attachEvent && e.attachEvent("on" + f, b);
        }
        function f(e, f, b, c) {
            "function" == typeof e.removeEventListener ? e.removeEventListener(f, b, c || !1) : "function" == typeof e.detatchEvent && e.detatchEvent("on" + f, b);
        }
        function t(j, k) {
            var b = Math.max(j.top, k.top),
                c = Math.min(j.bottom, k.bottom),
                d = Math.max(j.left, k.left),
                e = Math.min(j.right, k.right),
                f = e - d,
                g = c - b;
            return 0 <= f && 0 <= g && { top: b, bottom: c, left: d, right: e, width: f, height: g };
        }
        function u(c) {
            var d;
            try {
                d = c.getBoundingClientRect();
            } catch (b) {}
            return d ? ((d.width && d.height) || (d = { top: d.top, right: d.right, bottom: d.bottom, left: d.left, width: d.right - d.left, height: d.bottom - d.top }), d) : g();
        }
        function g() {
            return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
        }
        function j(d, e) {
            for (var b = e; b; ) {
                if (b == d) return !0;
                b = v(b);
            }
            return !1;
        }
        function v(c) {
            var d = c.parentNode;
            return d && 11 == d.nodeType && d.host ? d.host : d && d.assignedSlot ? d.assignedSlot.parentNode : d;
        }
        if ("IntersectionObserver" in o && "IntersectionObserverEntry" in o && "intersectionRatio" in o.IntersectionObserverEntry.prototype)
            return void (
                "isIntersecting" in o.IntersectionObserverEntry.prototype ||
                Object.defineProperty(o.IntersectionObserverEntry.prototype, "isIntersecting", {
                    get: function () {
                        return 0 < this.intersectionRatio;
                    },
                })
            );
        var k = [];
        (b.prototype.THROTTLE_TIMEOUT = 100),
            (b.prototype.POLL_INTERVAL = null),
            (b.prototype.USE_MUTATION_OBSERVER = !0),
            (b.prototype.observe = function (c) {
                var d = this._observationTargets.some(function (d) {
                    return d.element == c;
                });
                if (!d) {
                    if (!(c && 1 == c.nodeType)) throw new Error("target must be an Element");
                    this._registerInstance(), this._observationTargets.push({ element: c, entry: null }), this._monitorIntersections(), this._checkForIntersections();
                }
            }),
            (b.prototype.unobserve = function (c) {
                (this._observationTargets = this._observationTargets.filter(function (d) {
                    return d.element != c;
                })),
                    this._observationTargets.length || (this._unmonitorIntersections(), this._unregisterInstance());
            }),
            (b.prototype.disconnect = function () {
                (this._observationTargets = []), this._unmonitorIntersections(), this._unregisterInstance();
            }),
            (b.prototype.takeRecords = function () {
                var b = this._queuedEntries.slice();
                return (this._queuedEntries = []), b;
            }),
            (b.prototype._initThresholds = function (c) {
                var d = c || [0];
                return (
                    Array.isArray(d) || (d = [d]),
                    d.sort().filter(function (e, b, c) {
                        if ("number" != typeof e || isNaN(e) || 0 > e || 1 < e) throw new Error("threshold must be a number between 0 and 1 inclusively");
                        return e !== c[b - 1];
                    })
                );
            }),
            (b.prototype._parseRootMargin = function (c) {
                var d = (c || "0px").split(/\s+/).map(function (c) {
                    var d = /^(-?\d*\.?\d+)(px|%)$/.exec(c);
                    if (!d) throw new Error("rootMargin must be specified in pixels or percent");
                    return { value: parseFloat(d[1]), unit: d[2] };
                });
                return (d[1] = d[1] || d[0]), (d[2] = d[2] || d[0]), (d[3] = d[3] || d[1]), d;
            }),
            (b.prototype._monitorIntersections = function () {
                this._monitoringIntersections ||
                    ((this._monitoringIntersections = !0),
                    this.POLL_INTERVAL
                        ? (this._monitoringInterval = setInterval(this._checkForIntersections, this.POLL_INTERVAL))
                        : (e(o, "resize", this._checkForIntersections, !0),
                        e(q, "scroll", this._checkForIntersections, !0),
                        this.USE_MUTATION_OBSERVER &&
                            "MutationObserver" in o &&
                            ((this._domObserver = new MutationObserver(this._checkForIntersections)), this._domObserver.observe(q, { attributes: !0, childList: !0, characterData: !0, subtree: !0 }))));
            }),
            (b.prototype._unmonitorIntersections = function () {
                this._monitoringIntersections &&
                    ((this._monitoringIntersections = !1),
                    clearInterval(this._monitoringInterval),
                    (this._monitoringInterval = null),
                    f(o, "resize", this._checkForIntersections, !0),
                    f(q, "scroll", this._checkForIntersections, !0),
                    this._domObserver && (this._domObserver.disconnect(), (this._domObserver = null)));
            }),
            (b.prototype._checkForIntersections = function () {
                var e = this._rootIsInDom(),
                    j = e ? this._getRootRect() : g();
                this._observationTargets.forEach(function (b) {
                    var d = b.element,
                        f = u(d),
                        g = this._rootContainsTarget(d),
                        m = b.entry,
                        n = e && g && this._computeTargetAndRootIntersection(d, j),
                        k = (b.entry = new s({ time: c(), target: d, boundingClientRect: f, rootBounds: j, intersectionRect: n }));
                    m ? (e && g ? this._hasCrossedThreshold(m, k) && this._queuedEntries.push(k) : m && m.isIntersecting && this._queuedEntries.push(k)) : this._queuedEntries.push(k);
                }, this),
                    this._queuedEntries.length && this._callback(this.takeRecords(), this);
            }),
            (b.prototype._computeTargetAndRootIntersection = function (b, c) {
                if ("none" != o.getComputedStyle(b).display) {
                    for (var d = u(b), e = d, j = v(b), m = !1; !m; ) {
                        var n = null,
                            s = 1 == j.nodeType ? o.getComputedStyle(j) : {};
                        if ("none" == s.display) return;
                        if ((j == this.root || j == q ? ((m = !0), (n = c)) : j != q.body && j != q.documentElement && "visible" != s.overflow && (n = u(j)), n && ((e = t(n, e)), !e))) break;
                        j = v(j);
                    }
                    return e;
                }
            }),
            (b.prototype._getRootRect = function () {
                var b;
                if (this.root) b = u(this.root);
                else {
                    var e = q.documentElement,
                        c = q.body;
                    b = { top: 0, left: 0, right: e.clientWidth || c.clientWidth, width: e.clientWidth || c.clientWidth, bottom: e.clientHeight || c.clientHeight, height: e.clientHeight || c.clientHeight };
                }
                return this._expandRectByRootMargin(b);
            }),
            (b.prototype._expandRectByRootMargin = function (d) {
                var e = this._rootMarginValues.map(function (e, b) {
                        return "px" == e.unit ? e.value : (e.value * (b % 2 ? d.width : d.height)) / 100;
                    }),
                    b = { top: d.top - e[0], right: d.right + e[1], bottom: d.bottom + e[2], left: d.left - e[3] };
                return (b.width = b.right - b.left), (b.height = b.bottom - b.top), b;
            }),
            (b.prototype._hasCrossedThreshold = function (g, j) {
                var b = g && g.isIntersecting ? g.intersectionRatio || 0 : -1,
                    c = j.isIntersecting ? j.intersectionRatio || 0 : -1;
                if (b !== c) for (var d, k = 0; k < this.thresholds.length; k++) if (((d = this.thresholds[k]), d == b || d == c || d < b != d < c)) return !0;
            }),
            (b.prototype._rootIsInDom = function () {
                return !this.root || j(q, this.root);
            }),
            (b.prototype._rootContainsTarget = function (b) {
                return j(this.root || q, b);
            }),
            (b.prototype._registerInstance = function () {
                0 > k.indexOf(this) && k.push(this);
            }),
            (b.prototype._unregisterInstance = function () {
                var b = k.indexOf(this);
                -1 != b && k.splice(b, 1);
            }),
            (o.IntersectionObserver = b),
            (o.IntersectionObserverEntry = s);
    })(window, document),
    (function() { 
        var lazyImages = [].slice.call(document.querySelectorAll("img.lazy"));
        
        if ("IntersectionObserver" in window) {
            var d = [];
            let lazyImageObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    let lazyImage = entry.target;
                    lazyImageObserver.unobserve(lazyImage);
                    lazyImage.classList.remove("lazy");
                    lazyImage.removeAttribute("srcset");
                }
            });
        }, {rootMargin: "0px 0px 300px 0px"});
        
        lazyImages.forEach(function(lazyImage) {
            lazyImageObserver.observe(lazyImage);
        });
        
        let tns = [].slice.call(document.querySelectorAll(".thumb-body .thumb img"));
    
        let tnsObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                let tn = entry.target;
                
                if (tn.complete) d.push(tn.closest(".thumb-body .thumb").dataset.gid);
                else {
                    tn.onload=function(){d.push(this.closest(".thumb-body .thumb").dataset.gid)};
                    tn.onerror=function(){d.push("~"+this.closest(".thumb-body .thumb").dataset.gid)}
                }
            
                tnsObserver.unobserve(tn);
            }
            });
        }, {threshold:.5});
        
            tns.forEach(function(tn) {
                tnsObserver.observe(tn);
            });
        } else {
                lazyImages.forEach(function(lazyImage) {
                lazyImage.removeAttribute("srcset");
            });
        }
    })();
}
//eof thumbs

function initSearchForm(searchForm, searchInput) {
    const $form = $(searchForm);
    const $input = $(searchInput);

    if (!$form.length || !$input.length) return;

    $form.submit(function(e) {
        e.preventDefault();

        let inputText = $input.val().trim();
        inputText = inputText.replace(/[^\p{L}\p{N}\s]/gu, '');

        if (!inputText) return;

        let cleanedText = inputText.trim().split(/\s+/).join('-');

        cleanedText = cleanedText.replace(/^-+|-+$/g, '');

        if (!cleanedText) return;

        let formattedText = encodeURIComponent(cleanedText).toLowerCase();
        let tag = $form.data('tag');
        let newUrl = "/" + tag + "/" + formattedText;

        window.location.href = newUrl;
    });
}
  
function initTagStripSlider(elClass) {
    const sliders = document.querySelectorAll(elClass);
    if(sliders) {
        sliders.forEach(function(slider) {
            const sliderList = slider.querySelector('.tagstrip-list');
            const slides = slider.querySelectorAll('.tagstrip-list-slide');
            const prevBtn = slider.querySelector('.slider-button.prev');
            const nextBtn = slider.querySelector('.slider-button.next');

            let currentIndex = 0;

            function updateButtons() {
                prevBtn.style.display = currentIndex === 0 ? 'none' : 'block';
                nextBtn.style.display = currentIndex === slides.length - 1 ? 'none' : 'block';
            }

            function goToSlide(index) {
                if (index < 0 || index >= slides.length) return;
                currentIndex = index;
                const offset = -currentIndex * slides[0].offsetWidth;
                sliderList.style.transform = `translateX(${offset}px)`;
                updateButtons();
            }

            prevBtn.addEventListener('click', function () {
                goToSlide(currentIndex - 1);
            });

            nextBtn.addEventListener('click', function () {
                goToSlide(currentIndex + 1);
            });

            updateButtons(); 
        });
    }
}
//eof all sites

function initSiteManifest() {
    var link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'https://static.xxxbp.tv/img/favicon2/site.webmanifest';
    document.head.appendChild(link);
}

function initDropMenu() {
    $(".js-drop").on("click", function (e) {
        if ($(e.target).is("a")) return true;
        
        if ($('.drop-menu').hasClass('drop-menu-active') && $(this).hasClass('drop-menu-show')) {
          
            $('.drop-menu').removeClass('drop-menu-active');
            $('.js-drop').removeClass('drop-menu-show');

        } else {
           
            $('.drop-menu').removeClass('drop-menu-active');
            $('.js-drop').removeClass('drop-menu-show');
            
            $(this).toggleClass('drop-menu-show');
            $(this).parents(".drop-menu-wrap").find('.drop-menu').toggleClass("drop-menu-active");
        }
        return false; 
    });

    ($(".js-main-nav-close").on("click", function () {
        var e = $(this).parents("body");
        e.removeClass("show-menu");
        e.removeClass("show-search");        
    }));
    
    $('html, body').on('click', function(e) {
        if ($(e.target).closest('.drop-menu').length || $(e.target).closest('.js-drop').length) {
            return
        } else {
            $('.drop-menu').removeClass('drop-menu-active');
            $('.js-drop').removeClass('drop-menu-show');
        }
        if ($(e.target).closest('.search').length || $(e.target).closest('.js-search-btn').length) {
            return
        } else {
            $('body').removeClass('show-search');
            $('.js-search-btn').removeClass('open-search');
        }
    });
}

function initTopLoggedPanel() {
    let watchHistory, favorites, liked;

    try {
        watchHistory = localStorage.getItem('metaWatchHistoryIds');
        favorites = localStorage.getItem('metaFavoritesIds');
        liked = localStorage.getItem('metaLikedIds');
    } catch (e) {
        // console.warn("[initTopLoggedPanel] Failed to access localStorage:", e);
        return;
    }

    if (!watchHistory) return;

    try {
        const wrapper = document.querySelector('.wrapper');
        if (wrapper && !wrapper.classList.contains('wrapper-logged')) {
            wrapper.classList.add('wrapper-logged');
        }

        const itemsToAdd = [
            { href: '/recommended', text: 'Recommended', icon: 'icon-hot' },
            { href: '/history', text: 'History', icon: 'icon-eye' }
        ];

        if (favorites) itemsToAdd.push({ href: '/favorites', text: 'Favorites', icon: 'icon-star' });
        if (liked) itemsToAdd.push({ href: '/liked', text: 'Liked', icon: 'icon-like' });

        const navList = $('.header-nav-list');
        const dropMenu = $('.drop-menu-logged .drop-menu');

        if (navList && dropMenu) {
            itemsToAdd.forEach(({ href, text }) => {
                const listItem = `<li><a href="${href}">${text}</a></li>`;
                navList.append(listItem);
                dropMenu.append(listItem);
            });
        } else {
            // console.warn("[initTopLoggedPanel] navList or dropMenu not found in DOM");
        }


        const mobMenuItems = Array.from(document.querySelectorAll('.mob-menu.ads-mobile ul li'));
        const menuItemsFiltered = mobMenuItems.filter(li => !li.querySelector('.mob-menu-logo'));
        const totalReplaceable = menuItemsFiltered.length;

        itemsToAdd.forEach((item, index) => {
            const replaceIndex = totalReplaceable - 1 - index;
            if (replaceIndex < 0) return;

            const li = menuItemsFiltered[replaceIndex];
            if (!li) return;

            li.innerHTML = `
                <a href="${item.href}">
                    <i class="mob-menu-ico ${item.icon}"></i>
                    <span class="mob-menu-title">${item.text}</span>
                </a>
            `;
        });

    } catch (e) {
        // console.warn("[initTopLoggedPanel] Unexpected error:", e);
    }
}


function initHeaderScroll() {
    var lastScrollTop = 0; 
    $(window).scroll(function() {
        var scrollPos = $(this).scrollTop();
        var isMobile = $(window).width() < 992;
      
        if (isMobile) {
            if (scrollPos > lastScrollTop) {
                $('.wrapper').removeClass('show-header').addClass('hidden-header');
            } else {
                $('.wrapper').addClass('show-header').removeClass('hidden-header');
            }
            if (scrollPos > lastScrollTop && scrollPos > 75 && scrollPos < 100) {
                $('.wrapper').removeClass('show-mob-menu');
            } else if (scrollPos > 100) {
                $('.wrapper').addClass('show-mob-menu');
            } else if (scrollPos < lastScrollTop && scrollPos < 76) {
                $('.wrapper').removeClass('show-mob-menu');
            }
        } else {
            if (scrollPos > lastScrollTop && scrollPos > 75 && scrollPos < 100) {
                $('.wrapper').addClass('hidden-header').removeClass('show-header');
            } else if (scrollPos > 100) {
                $('.wrapper').addClass('show-header').removeClass('hidden-header');
            } else if (scrollPos < lastScrollTop && scrollPos < 76) {
                $('.wrapper').removeClass('show-header hidden-header');
            }
        }

        lastScrollTop = scrollPos;
    });
}

function initOpenMenu() {
    ($(".js-menu-btn").on("click", function () {
        var e = $(this).parents("body");
        
        return e.hasClass("show-menu") ? e.removeClass("show-menu") : e.addClass("show-menu"), !1;
    }));
}

function initSmartSort(selectID, preferredLS) {

    function getCurrentBasePath() {
        return window.location.pathname + window.location.search;
    }

    function detectCurrentSort() {
        const currentPath = getCurrentBasePath();
        const select = document.getElementById(selectID);
        if (!select) return;

        $(select).find('option').each(function () {
            if ($(this).val() === currentPath) {
                $(this).prop('selected', true);
                return false;
            }
        });
    }

    function saveSortPreference(value) {
        const currentBase = getBaseCategory(window.location.pathname);
        const newBase = getBaseCategory(value);
        if (currentBase === newBase) {
            localStorage.setItem(preferredLS, value);
        } else {
            localStorage.removeItem(preferredLS); 
        }
    }

    function loadSortPreference() {
        return localStorage.getItem(preferredLS);
    }

    function getBaseCategory(path) {
        const parts = path.split('/');
        return '/' + parts.slice(1, 3).join('/') + '/';
    }

    function clearInvalidSortIfNeeded() {
        const currentBase = getBaseCategory(window.location.pathname);
        const savedValue = loadSortPreference();
        if (!savedValue) return;

        const savedBase = getBaseCategory(savedValue);
        if (savedBase !== currentBase) {
            localStorage.removeItem(preferredLS);
        }
    }

    function initSort() {
        const select = document.getElementById(selectID);
        if (!select) return;

        clearInvalidSortIfNeeded();
        detectCurrentSort();

        const currentVal = $(select).val();
        const defaultVal = $(select).find('option:first').val();
        const saved = loadSortPreference();

        if (currentVal === defaultVal && saved) {
            $(select).val(saved);
        }
    }

    initSort();

    $("#" + selectID).on("change", function () {
        saveSortPreference($(this).val());
    });

    $(".js-apply-sort").on("click", function () {
        const select = document.getElementById(selectID);
        if (!select) return;

        const selectedValue = select.value;
        if (selectedValue) {
            saveSortPreference(selectedValue);
            window.location.href = selectedValue;
        }
    });
}

function initOpenFilter() {
    $(".js-filter").on("click", function () {
        var e = $(this).parents("body");
        
        $(this).toggleClass('open-filter');

        return e.hasClass("show-filter") ? e.removeClass("show-filter") : e.addClass("show-filter"), !1;
    });
}

function initOpenSearch() {
    ($(".js-search-btn").on("click", function () {
        var e = $(this).parents("body");
        
        $(this).toggleClass('open-search');

        return e.hasClass("show-search") ? e.removeClass("show-search") : e.addClass("show-search"), !1;
    }));
}

function initRecommendedBlock() {
    const container = document.querySelector('.recommended-thumbs');
    const cacheDataStorage = 'similarDataCache';
    const cacheTimestamp = 15 * 60 * 1000;

    if (!container) {
        // console.warn('[initRecommendedBlock] Container not found.');
        return;
    }

    let storedData;

    try {
        storedData = JSON.parse(localStorage.getItem('metaLastTenWatchHistoryIds'));
    } catch (e) {
        // console.warn('[initRecommendedBlock] Error parsing metaLastTenWatchHistoryIds from localStorage:', e);
        return;
    }

    if (!storedData || !Array.isArray(storedData)) {
        // console.warn('[initRecommendedBlock] No valid storedData found.');
        return;
    }

    const ids = storedData.map(item => item.id).join(',');
    const url = `https://api.${domain_name}/recommended?domain=${domain_name}&ids=${ids}`;

    let cachedData;
    const now = Date.now();

    try {
        cachedData = JSON.parse(localStorage.getItem(cacheDataStorage));
    } catch (e) {
        // console.warn('[initRecommendedBlock] Error parsing cache from localStorage:', e);
    }

    if (cachedData && now - cachedData.timestamp < cacheTimestamp) {
        const randomItems = getRandomItems(cachedData.data, 10);
        displayThumbnails(randomItems);
    } else {
        fetch(url)
            .then(response => response.json())
            .then(data => {
                const randomItems = getRandomItems(data, 10);
                displayThumbnails(randomItems);

                try {
                    localStorage.setItem(cacheDataStorage, JSON.stringify({ data, timestamp: now }));
                } catch (e) {
                    // console.warn('[initRecommendedBlock] Failed to cache recommended data:', e);
                }
            })
            .catch(error => {
                // console.warn('[initRecommendedBlock] Fetch error:', error);
            });
    }

    function getRandomItems(arr, count) {
        const shuffled = arr.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, count);
    }

    function displayThumbnails(items) {
        const container = document.querySelector('.recommended-thumbs');
        if (!container) {
            // console.warn('[displayThumbnails] Container not found.');
            return;
        }

        container.innerHTML = `
            <div class="heading heading-nosort">
                <div class="heading-text heading-text-nosort">
                    <div class="heading-ico-box">
                        <i class="heading-ico-bg icon-headline-bg"><span class="path1"></span><span class="path2"></span><span class="path3"></span><span class="path4"></span><span class="path5"></span></i>
                        <i class="heading-ico icon-headline-video"></i>
                    </div>
                    <div class="heading-text-box">
                        <h2 class="heading-title">Recommended videos</h2>
                    </div>
                </div>
            </div>
            <div id="thumbnails-container" class="thumbs-wrapper thumb-body thumbs-pagination"></div>
            <div class="pagination-wrap related-more">
                <div class="pagination">
                    <div class="pagination-nav-wrap pagination-item-preactive"></div>
                    <a href="/recommended" class="show-more pagination-item pagination-item-active item">
                        <span class="show-more-title">Load More</span>
                        <i class="show-more-ico icon-arrow-bottom"></i>
                    </a>
                    <div class="pagination-nav-wrap pagination-item-postactive"></div>
                </div>
            </div>
        `;

        const thumbnailsContainerUpdated = container.querySelector('#thumbnails-container');
       
        items.forEach(item => {
            const thumbnail = document.createElement('article');
            thumbnail.className = 'thumb';
            thumbnail.setAttribute('data-gid', item.id);
            thumbnail.innerHTML = `
                <a href="${item.content_url}" title="${item.key}">
                    <div class="thumb-holder">
                        <div class="img-wrap">
                            <img decoding="async" class="lazy" src="${item.thumbnail_url}" srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="${item.key}" data-preview="${item.cdn_mp4_preview}">
                            <button class="thumb-preview-btn js-thumb-preview-btn" type="button"><i class="icon-eye"></i></button>
                        </div> 
                    </div> 
                    <div class="thumb-bottom">    
                        <div class="thumb-title">
                            ${item.key}
                        </div>
                        <div class="thumb-info">
                            <div class="thumb-info-rating">
                                <div class="thumb-box">
                                    <i class="thumb-box-ico icon-nobg-like"></i>
                                    <span class="thumb-box-title">${item.rate}%</span>
                                </div> 
                            </div>
                            <div class="thumb-info-block">
                                <div class="thumb-box">
                                    <i class="thumb-box-ico icon-nobg-duration"></i>
                                    <span class="thumb-box-title">${item.duration_human}</span>
                                </div>
                                <div class="thumb-box">
                                    <i class="thumb-box-ico icon-nobg-calendar"></i>
                                    <span class="thumb-box-title">${item.date_human}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </a>
            `;
            thumbnailsContainerUpdated.appendChild(thumbnail);
        });

        initLazyLoad();
        initThumbVideoPreview('.thumb','.js-thumb-preview-btn');
    }
}

function initTrendingBlock() {
    const container = document.querySelector('.trending-thumbs');
    const cacheDataStorage = 'trendingDataCache';
    const cacheTimestamp = 24 * 60 * 60 * 1000; // 1day
    if (!container) {
        // console.warn('[initTrendingBlock] Container not found.');
        return;
    }
 
    const url = `https://api.${domain_name}/rotate?domain=${domain_name}&country=${country_code}`;
    let cachedData;
    const now = Date.now();

    try {
        cachedData = JSON.parse(localStorage.getItem(cacheDataStorage));
    } catch (e) {
        // console.warn('[initTrendingBlock] Error parsing cache from localStorage:', e);
    }

    if (cachedData && now - cachedData.timestamp < cacheTimestamp) {
        displayThumbnails(cachedData.data.list, cachedData.data.country_name);
    } else {
        fetch(url)
            .then(response => response.json())
            .then(data => {

                if ('error' in data) {
                    // console.warn('[initTrendingBlock] returned error. Skipping render.');
                    return;
                }

                displayThumbnails(data.list, data.country_name);
                try {
                    localStorage.setItem(cacheDataStorage, JSON.stringify({ data, timestamp: now }));
                } catch (e) {
                    // console.warn('[initTrendingBlock] Failed to cache trending data:', e);
                }
            })
            .catch(error => {
                // console.warn('[initTrendingBlock] Fetch error:', error);
            });
    }

    function displayThumbnails(items, countryName = '') {
        const container = document.querySelector('.trending-thumbs');
        if (!container) {
            // console.warn('[displayThumbnails trending] Container not found.');
            return;
        }
 
        container.innerHTML = `
            <div class="heading heading-nosort">
                <div class="heading-text heading-text-nosort">
                    <div class="heading-ico-box">
                        <i class="heading-ico-bg icon-headline-bg">
                            <span class="path1"></span><span class="path2"></span>
                            <span class="path3"></span><span class="path4"></span><span class="path5"></span>
                        </i>
                        <i class="heading-ico icon-headline-video"></i>
                    </div>
                    <div class="heading-text-box">
                        <h2 class="heading-title">Trending videos in ${countryName}</h2>
                    </div>
                </div>
            </div>
            <div id="thumbnailsTrending-container" class="thumbs-wrapper thumb-body"></div>
        `;

        const thumbnailsContainer = container.querySelector('#thumbnailsTrending-container');
        if (!thumbnailsContainer) {
            // console.warn('[displayThumbnails] thumbnailsTrending-container not found.');
            return;
        }
 
        items.forEach(item => {
            const thumbnail = document.createElement('article');
            thumbnail.className = 'thumb';
            thumbnail.setAttribute('data-gid', item.id);
            thumbnail.innerHTML = `
                <div class="thumb-holder">
                    <a class="img-wrap" href="${item.content_url}" title="${item.key}">
                        <img decoding="async" class="lazy" src="${item.thumbnail_url}" alt="${item.key}" data-preview="${item.cdn_mp4_preview}">
                        <button class="thumb-preview-btn js-thumb-preview-btn" type="button"><i class="icon-eye"></i></button>
                    </a> 
                </div>  
                <div class="thumb-bottom">
                    <a class="thumb-title" href="${item.content_url}" title="${item.key}">${item.key}</a>
                    <div class="thumb-info">  
                        <div class="thumb-info-rating">
                            <div class="thumb-box">
                                <i class="thumb-box-ico icon-nobg-like"></i>
                                <span class="thumb-box-title">${item.rate}%</span>
                            </div> 
                        </div>        
                        <div class="thumb-info-block">
                            <div class="thumb-box">
                                <i class="thumb-box-ico icon-nobg-duration"></i>
                                <span class="thumb-box-title">${item.duration_human}</span>
                            </div>
                            <div class="thumb-box">
                                <i class="thumb-box-ico icon-nobg-calendar"></i>
                                <span class="thumb-box-title">${item.date_human}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            thumbnailsContainer.appendChild(thumbnail);
        });

        initLazyLoad();
        initThumbVideoPreview('.thumb', '.js-thumb-preview-btn');
    }
}

function initReportPageSendReportForm() {
   if(domain_name) {
        $('.report-page-form').on('submit', function (e) {
            e.preventDefault();

            const selectedReason = $('.report-page-form .report-list__radio-input:checked').val();
            const comment = $('.report-page-form .report-list__textarea_comment').val().trim();
            const urlsRaw = $('.report-page-form .report-list__textarea_urls').val().trim();
            const errorContainer = $('.report-page-form .report-list__error-message');
            const errorContainerUrls = $('.report-page-form .report-list__error-message_urls');
            const errorContainerComment = $('.report-page-form .report-list__error-message_comment');

            errorContainer.hide();
            errorContainerUrls.hide();
            errorContainerComment.hide();

            const urlPattern = new RegExp(`^https://${domain_name}/video/\\d+/[a-zA-Z0-9-]+$`);

            const urls = Array.from(
                new Set(
                    urlsRaw
                        .split(/\s+/) 
                        .map(url => url.trim())
                        .filter(url => urlPattern.test(url))
                )
            );

            if (urls.length === 0) {
                errorContainerUrls.text("Please enter at least one valid URL starting with https://" + domain_name + "/video/...").show();
                return;
            }

            if (comment.length < 60) {
                errorContainerComment.text("Your comment must be at least 60 characters.").show();
                return;
            }

            $('.report-modal__subtitle').hide();
            $('.report-list').hide();
            $('.report-modal__success-message').show();

            urls.forEach((url, index) => {
                const formData = {
                    url: url,
                    reason: String(selectedReason),
                    comment: comment
                };

                $.ajax({
                    url: '/abuse/',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(formData),
                    success: function () {
                        if (index === urls.length - 1) {
                            location.reload();
                        }
                    },
                    error: function (xhr, status, error) {
                    }
                });
            });
        });
    }
}