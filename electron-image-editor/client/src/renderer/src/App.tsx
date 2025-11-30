import React, { useEffect } from 'react';
import { ConfigProvider, App as AntdApp } from 'antd';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { fetchImages } from './store/slices/imagesSlice';
import { fetchSyncStatus } from './store/slices/syncSlice';
import MainLayout from './components/Layout/MainLayout';
import GalleryViewer from './components/GalleryViewer/GalleryViewer';
import SingleImageViewer from './components/SingleViewer/SingleImageViewer';
import SyncPanel from './components/Sync/SyncPanel';
import SystemActivity from './components/SystemActivity/SystemActivity';
import Settings from './components/Settings/Settings';
import { darkTheme, lightTheme } from './theme';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { sidebarTab, theme: currentTheme } = useAppSelector((state) => state.ui);

  useEffect(() => {
    // Initial data fetch
    dispatch(fetchImages({ page: 1, limit: 10 }));
    dispatch(fetchSyncStatus());

    // Debug API

  }, [dispatch]);

  const renderContent = () => {
    switch (sidebarTab) {
      case 'gallery':
        return <GalleryViewer />;
      case 'single':
        return <SingleImageViewer />;
      case 'sync':
        return <SyncPanel />;
      case 'systemActivity':
        return <SystemActivity />;
      case 'settings':
        return <Settings />;
      default:
        return <GalleryViewer />;
    }
  };

  return (
    <ConfigProvider theme={currentTheme === 'dark' ? darkTheme : lightTheme}>
      <AntdApp>
        <MainLayout>
          {renderContent()}
        </MainLayout>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
