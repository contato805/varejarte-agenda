import React, { useMemo } from "react";

const TAB_PAGES = ["Dashboard", "Agenda", "Reports"];

export default function PersistentTabs({ currentPageName, Pages, LayoutWrapper }) {
  const isTabPage = TAB_PAGES.includes(currentPageName);

  // Only render persistent tabs when we're on one of the tab pages
  if (!isTabPage) return null;

  return (
    <>
      {TAB_PAGES.map((pageName) => {
        const PageComponent = Pages[pageName];
        if (!PageComponent) return null;
        const isActive = currentPageName === pageName;
        return (
          <div
            key={pageName}
            style={{ display: isActive ? "block" : "none" }}
          >
            <LayoutWrapper currentPageName={pageName}>
              <PageComponent />
            </LayoutWrapper>
          </div>
        );
      })}
    </>
  );
}