import React, { useEffect, useState } from "react";
import {
  Layout,
  Card,
  Typography,
  Button,
  Table,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  Grid,
  theme,
  App,
  Modal,
  Checkbox,
  Select,
  Alert,
  Collapse,
  List,
  Empty,
} from "antd";
import {
  CloudSyncOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  RightOutlined,
  DownOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  FileImageOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchSyncStatus,
  fetchSyncLogs,
  pushToServer,
  pullFromServer,
} from "../../store/slices/syncSlice";
import { fetchImages } from "../../store/slices/imagesSlice";

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { useToken } = theme;
const { useBreakpoint } = Grid;

const SyncPanel: React.FC = () => {
  const { token } = useToken();
  const screens = useBreakpoint();
  const dispatch = useAppDispatch();
  const { status, lastSyncTime, localImages, serverImages, logs, error } =
    useAppSelector((state) => state.sync);
  const { items: images } = useAppSelector((state) => state.images);
  const { items: folders } = useAppSelector((state) => state.folders);
  const { message, modal } = App.useApp();

  const [isImageSelectionVisible, setIsImageSelectionVisible] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
  const [downloadPath, setDownloadPath] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["root"])
  );
  const [syncStrategy, setSyncStrategy] = useState<string>(
    localStorage.getItem("syncStrategy") || "last_write_wins"
  );
  const [syncFolder, setSyncFolder] = useState<string | null>(
    localStorage.getItem("syncFolder")
  );
  const [syncDetails, setSyncDetails] = useState<{
    pullResult?: any;
    pushResult?: any;
    timestamp?: string;
  } | null>(null);

  // Update expanded folders when folders change
  useEffect(() => {
    const newExpanded = new Set(expandedFolders);
    newExpanded.add("root");
    folders.forEach((f) => newExpanded.add(f.id.toString()));
    setExpandedFolders(newExpanded);
  }, [folders]);

  useEffect(() => {
    dispatch(fetchSyncStatus());
    dispatch(fetchSyncLogs(50));

    // Auto-refresh logs every 30 seconds
    const interval = setInterval(() => {
      dispatch(fetchSyncStatus());
      dispatch(fetchSyncLogs(50));
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch]);

  // Load sync folder from localStorage on mount and validate it exists
  useEffect(() => {
    const validateAndLoadSyncFolder = async () => {
      const folder = localStorage.getItem("syncFolder");
      if (folder) {
        // Check if folder still exists
        const exists = await (window as any).api.exists(folder);
        if (!exists) {
          // Clear invalid folder configuration
          localStorage.removeItem("syncFolder");
          setSyncFolder(null);
          message.warning(
            `Sync folder no longer exists: ${folder}. Please reconfigure.`
          );
        } else {
          setSyncFolder(folder);
        }
      } else {
        setSyncFolder(null);
      }
    };
    validateAndLoadSyncFolder();
  }, []);

  const handleSetSyncFolder = async () => {
    try {
      const result = await (window as any).api.openDirectory();
      if (!result.canceled && result.filePaths.length > 0) {
        const folder = result.filePaths[0];
        localStorage.setItem("syncFolder", folder);
        setSyncFolder(folder);
        message.success("Sync folder configured successfully!");
      }
    } catch (error) {
      message.error("Failed to select folder");
    }
  };

  const handleOpenSyncFolder = async () => {
    if (!syncFolder) return;
    try {
      // Check if folder exists before opening
      const exists = await (window as any).api.exists(syncFolder);
      if (!exists) {
        // Clear invalid folder configuration
        localStorage.removeItem("syncFolder");
        setSyncFolder(null);
        message.error(
          `Sync folder does not exist: ${syncFolder}. Configuration has been cleared. Please reconfigure.`
        );
        return;
      }
      const result = await (window as any).api.openPath(syncFolder);
      // openPath returns { success: true } on success, { success: false, error } on failure
      if (!result.success) {
        message.error(
          `Failed to open folder: ${result.error || "Unknown error"}`
        );
      }
    } catch (error: any) {
      message.error(
        `Failed to open folder: ${error.message || "Unknown error"}`
      );
    }
  };

  const checkSyncFolder = async (): Promise<boolean> => {
    const folder = localStorage.getItem("syncFolder");
    if (folder) {
      // Validate folder still exists
      const exists = await (window as any).api.exists(folder);
      if (!exists) {
        // Clear invalid folder configuration
        localStorage.removeItem("syncFolder");
        setSyncFolder(null);
        return false;
      }
      return true;
    }

    return new Promise((resolve) => {
      modal.warning({
        title: "⚠️ Sync Folder Not Configured",
        content: (
          <div>
            <p style={{ marginBottom: 12 }}>
              Please configure a sync folder to enable sync operations.
            </p>
            <p style={{ color: "rgba(0, 0, 0, 0.65)", fontSize: 12 }}>
              The sync folder is used for:
            </p>
            <ul
              style={{
                marginTop: 8,
                paddingLeft: 20,
                color: "rgba(0, 0, 0, 0.65)",
                fontSize: 12,
              }}
            >
              <li>
                Pull from Server: Download images from server to local folder
              </li>
              <li>Push to Server: Upload images from local folder to server</li>
            </ul>
          </div>
        ),
        okText: "Select Folder",
        cancelText: "Cancel",
        width: 500,
        onOk: async () => {
          try {
            const result = await (window as any).api.openDirectory();
            if (!result.canceled && result.filePaths.length > 0) {
              const folder = result.filePaths[0];
              localStorage.setItem("syncFolder", folder);
              setSyncFolder(folder);
              message.success("Sync folder configured successfully!");
              resolve(true); // Return true so user can continue after setting folder
            } else {
              resolve(false);
            }
          } catch (error) {
            message.error("Failed to select folder");
            resolve(false);
          }
        },
        onCancel: () => resolve(false),
      });
    });
  };

  const handleStrategyChange = (value: string) => {
    setSyncStrategy(value);
    localStorage.setItem("syncStrategy", value);
    message.success(`Sync strategy changed to: ${getStrategyName(value)}`);
  };

  const getStrategyName = (strategy: string): string => {
    const names: Record<string, string> = {
      last_write_wins: "Last Write Wins",
      server_always_wins: "Server Always Wins",
      local_always_wins: "Local Always Wins",
    };
    return names[strategy] || strategy;
  };

  const getStrategyDescription = (strategy: string): string => {
    const descriptions: Record<string, string> = {
      last_write_wins:
        "Keep the version with the latest modification timestamp",
      server_always_wins:
        "Server version always takes precedence, local changes will be overwritten",
      local_always_wins:
        "Local version always takes precedence, server changes will be overwritten",
    };
    return descriptions[strategy] || "";
  };

  const handleSync = async () => {
    if (!(await checkSyncFolder())) return;

    try {
      console.log("Starting sync with strategy:", syncStrategy);

      // Perform sync based on strategy
      // - Local Always Wins: Only Push (local is truth source, make server match local)
      // - Server Always Wins: Only Pull (server is truth source, make local match server)
      // - Last Write Wins: Both Pull and Push (bidirectional sync)

      let pullResult: any = {
        pulledImages: 0,
        updatedImages: 0,
        deletedImages: 0,
        conflictsResolved: 0,
      };
      let pushResult: any = {
        pushedImages: 0,
        updatedImages: 0,
        deletedImages: 0,
        conflictsResolved: 0,
      };

      if (syncStrategy === "local_always_wins") {
        // Local is truth source: Only Push to make server match local
        console.log("Pushing to server (local is truth source)...");
        pushResult = await dispatch(pushToServer(syncStrategy)).unwrap();
        console.log("Push result:", pushResult);
      } else if (syncStrategy === "server_always_wins") {
        // Server is truth source: Only Pull to make local match server
        console.log("Pulling from server (server is truth source)...");
        pullResult = await dispatch(pullFromServer(syncStrategy)).unwrap();
        console.log("Pull result:", pullResult);
      } else {
        // Last Write Wins: Bidirectional sync (Pull first, then Push)
        console.log("Pulling from server...");
        pullResult = await dispatch(pullFromServer(syncStrategy)).unwrap();
        console.log("Pull result:", pullResult);

        console.log("Pushing to server...");
        pushResult = await dispatch(pushToServer(syncStrategy)).unwrap();
        console.log("Push result:", pushResult);
      }

      // Combine results
      const allDetails = [];

      // Pull details
      if (pullResult?.pulledImages > 0)
        allDetails.push(`${pullResult.pulledImages} downloaded`);
      if (pullResult?.updatedImages > 0)
        allDetails.push(`${pullResult.updatedImages} updated (from server)`);
      if (pullResult?.deletedImages > 0)
        allDetails.push(`${pullResult.deletedImages} deleted locally`);

      // Push details
      if (pushResult?.pushedImages > 0)
        allDetails.push(`${pushResult.pushedImages} uploaded`);
      if (pushResult?.updatedImages > 0)
        allDetails.push(`${pushResult.updatedImages} updated (to server)`);
      if (pushResult?.deletedImages > 0)
        allDetails.push(`${pushResult.deletedImages} deleted from server`);

      // Conflicts
      const totalConflicts =
        (pullResult?.conflictsResolved || 0) +
        (pushResult?.conflictsResolved || 0);
      if (totalConflicts > 0)
        allDetails.push(`${totalConflicts} conflicts resolved`);

      const messageText = `Synchronization completed${
        allDetails.length > 0 ? ` (${allDetails.join(", ")})` : " (no changes)"
      }`;
      console.log("Sync completed:", messageText);
      message.success(messageText);

      // Store sync details for display
      setSyncDetails({
        pullResult,
        pushResult,
        timestamp: new Date().toISOString(),
      });

      dispatch(fetchSyncStatus());
      dispatch(fetchSyncLogs(50));
      dispatch(fetchImages({ page: 1, limit: 50 }));
    } catch (error: any) {
      console.error("Sync error:", error);
      const errorMessage =
        error?.message || error?.toString() || "Unknown error";
      message.error(`Sync failed: ${errorMessage}`);
    }
  };

  const handleDownloadToCustom = async () => {
    try {
      const result = await (window as any).api.openDirectory();
      if (!result.canceled && result.filePaths.length > 0) {
        const folder = result.filePaths[0];
        setDownloadPath(folder);
        // Fetch all images
        await dispatch(fetchImages({}));
        setSelectedImageIds([]); // Reset selection
        setIsImageSelectionVisible(true);
      }
    } catch (error) {
      message.error("Failed to select download folder");
    }
  };

  const handleConfirmDownload = async () => {
    if (selectedImageIds.length === 0) {
      message.warning("Please select at least one image to download");
      return;
    }

    if (!downloadPath) {
      message.error("No download path specified");
      return;
    }

    try {
      // Ensure target directory exists
      const exists = await (window as any).api.exists(downloadPath);
      if (!exists) {
        await (window as any).api.createDirectory(downloadPath);
      }

      // Download selected images
      let successCount = 0;
      for (const imageId of selectedImageIds) {
        const image = images.find((img) => img.id === imageId);
        if (!image) continue;

        try {
          // Fetch image data
          const response = await fetch(
            `http://localhost:3000/api/images/${imageId}/file`
          );
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);

          // Ensure filename has extension
          let filename = image.originalName;
          const ext = `.${image.format.toLowerCase()}`;
          if (!filename.toLowerCase().endsWith(ext)) {
            filename += ext;
          }

          // Save to disk
          const filePath = await (window as any).api.pathJoin(
            downloadPath,
            filename
          );
          const writeResult = await (window as any).api.writeFile(filePath, buffer);
          if (writeResult && writeResult.success === false) {
            throw new Error(writeResult.error || "Failed to write file");
          }
          successCount++;
        } catch (err: any) {
          console.error(`Failed to download image ${imageId}:`, err);
        }
      }

      message.success(
        `Successfully downloaded ${successCount} of ${selectedImageIds.length} images`
      );
      setIsImageSelectionVisible(false);
      setSelectedImageIds([]);
    } catch (error: any) {
      message.error(`Download failed: ${error.message}`);
    }
  };

  const columns = [
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      render: (text: string) => <Tag color="blue">{text.toUpperCase()}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        let color = "default";
        let icon = null;

        if (status === "success") {
          color = "success";
          icon = <CheckCircleOutlined />;
        } else if (status === "failed") {
          color = "error";
          icon = <CloseCircleOutlined />;
        } else {
          color = "processing";
          icon = <SyncOutlined spin />;
        }

        return (
          <Tag icon={icon} color={color}>
            {status.toUpperCase()}
          </Tag>
        );
      },
    },
  ];

  return (
    <Content style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        Synchronization
      </Title>

      <Row gutter={[16, 16]}>
        {/* Status Cards - Responsive: full width on mobile, 1/3 on tablet+, stacked on small screens */}
        <Col xs={24} sm={24} md={8}>
          <Card bordered={false} style={{ background: token.colorBgContainer }}>
            <Statistic
              title="Local Images"
              value={localImages}
              prefix={<CloudUploadOutlined />}
              valueStyle={{ color: token.colorText }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={24} md={8}>
          <Card bordered={false} style={{ background: token.colorBgContainer }}>
            <Statistic
              title="Server Images"
              value={serverImages}
              prefix={<CloudDownloadOutlined />}
              valueStyle={{ color: token.colorText }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={24} md={8}>
          <Card bordered={false} style={{ background: token.colorBgContainer }}>
            <Statistic
              title="Last Sync"
              value={
                lastSyncTime ? new Date(lastSyncTime).toLocaleString() : "Never"
              }
              prefix={<CloudSyncOutlined />}
              valueStyle={{ color: token.colorText, fontSize: screens.xs ? 14 : 16 }}
            />
          </Card>
        </Col>

        {/* Sync Folder Configuration */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <FolderOutlined />
                <span>Sync Folder Configuration</span>
              </Space>
            }
            bordered={false}
            style={{ background: token.colorBgContainer }}
          >
            {syncFolder ? (
              <Space
                direction="vertical"
                style={{ width: "100%" }}
                size="middle"
              >
                <Alert
                  message="Sync folder configured"
                  description={
                    <Space>
                      <Text code style={{ fontSize: 12 }}>
                        {syncFolder}
                      </Text>
                      <Button
                        type="link"
                        size="small"
                        onClick={handleSetSyncFolder}
                      >
                        Change
                      </Button>
                    </Space>
                  }
                  type="success"
                  showIcon
                />
                <Space>
                  <Button
                    icon={<FolderOpenOutlined />}
                    onClick={handleOpenSyncFolder}
                  >
                    Open Folder
                  </Button>
                  <Button onClick={handleSetSyncFolder}>Change Folder</Button>
                </Space>
              </Space>
            ) : (
              <Alert
                message="Sync folder not configured"
                description={
                  <Space>
                    <Text>
                      Please configure a sync folder to enable sync operations.
                      The sync folder is used to synchronize images between
                      local and server.
                    </Text>
                    <Button
                      type="primary"
                      icon={<FolderOpenOutlined />}
                      onClick={handleSetSyncFolder}
                    >
                      Select Sync Folder
                    </Button>
                  </Space>
                }
                type="warning"
                showIcon
              />
            )}
          </Card>
        </Col>

        {/* Conflict Resolution Strategy */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <InfoCircleOutlined />
                <span>Conflict Resolution Strategy</span>
              </Space>
            }
            bordered={false}
            style={{ background: token.colorBgContainer }}
          >
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <div>
                <Text strong style={{ marginRight: 12 }}>
                  Strategy:
                </Text>
                <Select
                  value={syncStrategy}
                  onChange={handleStrategyChange}
                  style={{ width: 300 }}
                  size="large"
                >
                  <Option value="last_write_wins">Last Write Wins</Option>
                  <Option value="server_always_wins">Server Always Wins</Option>
                  <Option value="local_always_wins">Local Always Wins</Option>
                </Select>
              </div>
              <Alert
                message={getStrategyName(syncStrategy)}
                description={getStrategyDescription(syncStrategy)}
                type="info"
                showIcon
                style={{ marginTop: 8 }}
              />
            </Space>
          </Card>
        </Col>

        {/* Actions */}
        <Col span={24}>
          <Card
            title="Sync Actions"
            bordered={false}
            style={{ background: token.colorBgContainer }}
          >
            <Space size="large" wrap direction={screens.xs ? "vertical" : "horizontal"} style={{ width: screens.xs ? "100%" : "auto" }}>
              <Button
                type="primary"
                icon={<CloudSyncOutlined />}
                onClick={handleSync}
                loading={status === "syncing"}
                disabled={!syncFolder}
                size={screens.xs ? "middle" : "large"}
                block={screens.xs}
              >
                Sync
              </Button>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={handleDownloadToCustom}
                loading={status === "syncing"}
                size={screens.xs ? "middle" : "large"}
                block={screens.xs}
              >
                Download to Custom
              </Button>

              {status === "syncing" && (
                <Tag color="processing" icon={<SyncOutlined spin />}>
                  Syncing...
                </Tag>
              )}
              {error && <Tag color="error">{error}</Tag>}
            </Space>
          </Card>
        </Col>

        {/* Recent Sync Details */}
        {syncDetails && (
          <Col span={24}>
            <Card
              title="Last Sync Details"
              bordered={false}
              style={{ background: token.colorBgContainer }}
            >
              <Collapse
                size="small"
                ghost
                items={[
                  {
                    key: "sync-details",
                    label: (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "4px 0",
                        }}
                      >
                        <CloudSyncOutlined
                          style={{ color: token.colorSuccess }}
                        />
                        <Text strong style={{ fontSize: 13 }}>
                          Sync
                        </Text>
                        <Tag color="success" style={{ fontSize: 10 }}>
                          SUCCESS
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Strategy:{" "}
                          {syncDetails.pullResult?.strategy ||
                            syncDetails.pushResult?.strategy ||
                            syncStrategy}
                        </Text>
                        <Text
                          type="secondary"
                          style={{ fontSize: 10, marginLeft: "auto" }}
                        >
                          {new Date(
                            syncDetails.timestamp || Date.now()
                          ).toLocaleString()}
                        </Text>
                      </div>
                    ),
                    children: (
                      <div style={{ padding: "8px 0", paddingLeft: 24 }}>
                        {/* Pull Details */}
                        {(syncDetails.pullResult?.pulledImages > 0 ||
                          syncDetails.pullResult?.updatedImages > 0 ||
                          syncDetails.pullResult?.deletedImages > 0) && (
                          <div style={{ marginBottom: 16 }}>
                            <Text
                              strong
                              style={{
                                fontSize: 12,
                                marginBottom: 8,
                                display: "block",
                              }}
                            >
                              Pull from Server:
                            </Text>
                            {syncDetails.pullResult?.downloadedImageList &&
                              syncDetails.pullResult.downloadedImageList
                                .length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <Text
                                    type="secondary"
                                    style={{
                                      fontSize: 11,
                                      marginBottom: 4,
                                      display: "block",
                                    }}
                                  >
                                    Downloaded (
                                    {
                                      syncDetails.pullResult.downloadedImageList
                                        .length
                                    }
                                    ):
                                  </Text>
                                  <List
                                    size="small"
                                    dataSource={
                                      syncDetails.pullResult.downloadedImageList
                                    }
                                    renderItem={(filename: string) => (
                                      <List.Item
                                        style={{
                                          padding: "4px 12px",
                                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            width: "100%",
                                          }}
                                        >
                                          <CloudDownloadOutlined
                                            style={{
                                              color: token.colorSuccess,
                                            }}
                                          />
                                          <Text style={{ fontSize: 11 }}>
                                            {filename}
                                          </Text>
                                        </div>
                                      </List.Item>
                                    )}
                                  />
                                </div>
                              )}
                            {syncDetails.pullResult?.updatedImageList &&
                              syncDetails.pullResult.updatedImageList.length >
                                0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <Text
                                    type="secondary"
                                    style={{
                                      fontSize: 11,
                                      marginBottom: 4,
                                      display: "block",
                                    }}
                                  >
                                    Updated (
                                    {
                                      syncDetails.pullResult.updatedImageList
                                        .length
                                    }
                                    ):
                                  </Text>
                                  <List
                                    size="small"
                                    dataSource={
                                      syncDetails.pullResult.updatedImageList
                                    }
                                    renderItem={(filename: string) => (
                                      <List.Item
                                        style={{
                                          padding: "4px 12px",
                                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            width: "100%",
                                          }}
                                        >
                                          <SyncOutlined
                                            style={{ color: token.colorInfo }}
                                          />
                                          <Text style={{ fontSize: 11 }}>
                                            {filename}
                                          </Text>
                                        </div>
                                      </List.Item>
                                    )}
                                  />
                                </div>
                              )}
                            {syncDetails.pullResult?.deletedImageList &&
                              syncDetails.pullResult.deletedImageList.length >
                                0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <Text
                                    type="secondary"
                                    style={{
                                      fontSize: 11,
                                      marginBottom: 4,
                                      display: "block",
                                    }}
                                  >
                                    Deleted Locally (
                                    {
                                      syncDetails.pullResult.deletedImageList
                                        .length
                                    }
                                    ):
                                  </Text>
                                  <List
                                    size="small"
                                    dataSource={
                                      syncDetails.pullResult.deletedImageList
                                    }
                                    renderItem={(filename: string) => (
                                      <List.Item
                                        style={{
                                          padding: "4px 12px",
                                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            width: "100%",
                                          }}
                                        >
                                          <DeleteOutlined
                                            style={{ color: token.colorError }}
                                          />
                                          <Text style={{ fontSize: 11 }}>
                                            {filename}
                                          </Text>
                                        </div>
                                      </List.Item>
                                    )}
                                  />
                                </div>
                              )}
                          </div>
                        )}

                        {/* Push Details */}
                        {(syncDetails.pushResult?.pushedImages > 0 ||
                          syncDetails.pushResult?.updatedImages > 0 ||
                          syncDetails.pushResult?.deletedImages > 0) && (
                          <div>
                            <Text
                              strong
                              style={{
                                fontSize: 12,
                                marginBottom: 8,
                                display: "block",
                              }}
                            >
                              Push to Server:
                            </Text>
                            {syncDetails.pushResult?.uploadedImageList &&
                              syncDetails.pushResult.uploadedImageList.length >
                                0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <Text
                                    type="secondary"
                                    style={{
                                      fontSize: 11,
                                      marginBottom: 4,
                                      display: "block",
                                    }}
                                  >
                                    Uploaded (
                                    {
                                      syncDetails.pushResult.uploadedImageList
                                        .length
                                    }
                                    ):
                                  </Text>
                                  <List
                                    size="small"
                                    dataSource={
                                      syncDetails.pushResult.uploadedImageList
                                    }
                                    renderItem={(filename: string) => (
                                      <List.Item
                                        style={{
                                          padding: "4px 12px",
                                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            width: "100%",
                                          }}
                                        >
                                          <CloudUploadOutlined
                                            style={{
                                              color: token.colorSuccess,
                                            }}
                                          />
                                          <Text style={{ fontSize: 11 }}>
                                            {filename}
                                          </Text>
                                        </div>
                                      </List.Item>
                                    )}
                                  />
                                </div>
                              )}
                            {syncDetails.pushResult?.updatedImageList &&
                              syncDetails.pushResult.updatedImageList.length >
                                0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <Text
                                    type="secondary"
                                    style={{
                                      fontSize: 11,
                                      marginBottom: 4,
                                      display: "block",
                                    }}
                                  >
                                    Updated (
                                    {
                                      syncDetails.pushResult.updatedImageList
                                        .length
                                    }
                                    ):
                                  </Text>
                                  <List
                                    size="small"
                                    dataSource={
                                      syncDetails.pushResult.updatedImageList
                                    }
                                    renderItem={(filename: string) => (
                                      <List.Item
                                        style={{
                                          padding: "4px 12px",
                                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            width: "100%",
                                          }}
                                        >
                                          <SyncOutlined
                                            style={{ color: token.colorInfo }}
                                          />
                                          <Text style={{ fontSize: 11 }}>
                                            {filename}
                                          </Text>
                                        </div>
                                      </List.Item>
                                    )}
                                  />
                                </div>
                              )}
                            {syncDetails.pushResult?.deletedImageList &&
                              syncDetails.pushResult.deletedImageList.length >
                                0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <Text
                                    type="secondary"
                                    style={{
                                      fontSize: 11,
                                      marginBottom: 4,
                                      display: "block",
                                    }}
                                  >
                                    Deleted from Server (
                                    {
                                      syncDetails.pushResult.deletedImageList
                                        .length
                                    }
                                    ):
                                  </Text>
                                  <List
                                    size="small"
                                    dataSource={
                                      syncDetails.pushResult.deletedImageList
                                    }
                                    renderItem={(filename: string) => (
                                      <List.Item
                                        style={{
                                          padding: "4px 12px",
                                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            width: "100%",
                                          }}
                                        >
                                          <DeleteOutlined
                                            style={{ color: token.colorError }}
                                          />
                                          <Text style={{ fontSize: 11 }}>
                                            {filename}
                                          </Text>
                                        </div>
                                      </List.Item>
                                    )}
                                  />
                                </div>
                              )}
                          </div>
                        )}

                        {(!syncDetails.pullResult ||
                          (syncDetails.pullResult.pulledImages === 0 &&
                            syncDetails.pullResult.updatedImages === 0 &&
                            syncDetails.pullResult.deletedImages === 0)) &&
                          (!syncDetails.pushResult ||
                            (syncDetails.pushResult.pushedImages === 0 &&
                              syncDetails.pushResult.updatedImages === 0 &&
                              syncDetails.pushResult.deletedImages === 0)) && (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="No changes"
                              style={{ margin: "10px 0" }}
                              imageStyle={{ height: 40 }}
                            />
                          )}
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        )}

        {/* Logs */}
        <Col span={24}>
          <Card
            title="Sync Logs"
            bordered={false}
            style={{ background: token.colorBgContainer }}
          >
            {(() => {
              // Filter to show only sync operations, not upload operations
              // Upload logs should be shown in the upload/activity panel instead
              const syncLogs = logs.filter(log => log.action === "sync");
              
              return syncLogs.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No sync logs"
                style={{ margin: "20px 0" }}
              />
            ) : (
              <Collapse
                size="small"
                ghost
                  items={syncLogs.map((log, index) => {
                  const details = log.details as any;

                  // Debug: log all logs to see what we have
                  if (index === 0) {
                    console.log("[SyncPanel] Total logs received:", logs.length);
                    console.log("[SyncPanel] Sync logs filtered:", syncLogs.length);
                    console.log("[SyncPanel] All logs:", logs.map(l => ({
                      id: l.id,
                      action: l.action,
                      timestamp: l.timestamp,
                      strategy: (l.details as any)?.strategy,
                      type: (l.details as any)?.type
                    })));
                    console.log(
                      "[SyncPanel] First log details:",
                      JSON.stringify(details, null, 2)
                    );
                    console.log("[SyncPanel] Details type:", details?.type);
                    console.log(
                      "[SyncPanel] Uploaded images:",
                      details?.uploadedImages
                    );
                    console.log(
                      "[SyncPanel] Updated images:",
                      details?.updatedImages
                    );
                    console.log(
                      "[SyncPanel] Deleted images:",
                      details?.deletedImages
                    );
                    console.log(
                      "[SyncPanel] Downloaded images:",
                      details?.downloadedImages
                    );
                  }

                  // Try to find related pull/push logs for bidirectional sync
                  // Only merge logs that are from the same sync operation (within 1 second)
                  // This prevents merging logs from different sync operations
                  const relatedLogs = logs.filter((l, idx) => {
                    if (idx === index) return false;
                    const lDetails = l.details as any;
                    const timeDiff = Math.abs(
                      new Date(l.timestamp).getTime() -
                        new Date(log.timestamp).getTime()
                    );
                    // Only merge if:
                    // 1. Same action type (sync)
                    // 2. Same strategy (must match exactly - different strategies should never merge)
                    // 3. Within 1 second (same sync operation - stricter than before)
                    // 4. Different type (pull vs push) - for bidirectional sync
                    // 5. Log must be immediately adjacent (idx === index + 1 or index - 1) to ensure same sync session
                    const isImmediatelyAdjacent = Math.abs(idx - index) === 1;
                    return (
                      l.action === "sync" &&
                      lDetails?.strategy === details?.strategy && // Strategy must match exactly
                      timeDiff < 1000 && // Within 1 second (same sync operation - stricter)
                      lDetails?.type !== details?.type && // Different type (pull vs push)
                      isImmediatelyAdjacent // Only merge immediately adjacent logs
                    );
                  });

                  // Get pull and push details
                  // If current log is pull, use its details; otherwise try to find related pull log
                  const pullDetails =
                    details?.type === "pull"
                      ? details
                      : relatedLogs.find(
                          (l) => (l.details as any)?.type === "pull"
                        )?.details;
                  // If current log is push, use its details; otherwise try to find related push log
                  const pushDetails =
                    details?.type === "push"
                      ? details
                      : relatedLogs.find(
                          (l) => (l.details as any)?.type === "push"
                        )?.details;
                  
                  // Debug: log merge information for first few logs
                  if (index < 3) {
                    console.log(`[SyncPanel] Log ${index} (ID: ${log.id}):`, {
                      strategy: details?.strategy,
                      type: details?.type,
                      timestamp: log.timestamp,
                      relatedLogsCount: relatedLogs.length,
                      hasPullDetails: !!pullDetails,
                      hasPushDetails: !!pushDetails,
                      relatedLogs: relatedLogs.map(l => ({
                        id: l.id,
                        strategy: (l.details as any)?.strategy,
                        type: (l.details as any)?.type,
                        timestamp: l.timestamp
                      }))
                    });
                  }

                  const getActionIcon = () => {
                    if (log.status === "success") {
                      return (
                        <CheckCircleOutlined
                          style={{ color: token.colorSuccess }}
                        />
                      );
                    } else if (log.status === "failed") {
                      return (
                        <CloseCircleOutlined
                          style={{ color: token.colorError }}
                        />
                      );
                    }
                    return (
                      <SyncOutlined spin style={{ color: token.colorInfo }} />
                    );
                  };

                  const getActionColor = () => {
                    if (log.status === "success") return "success";
                    if (log.status === "failed") return "error";
                    return "processing";
                  };

                  // Check if this is a bidirectional sync (has both pull and push)
                  const isBidirectionalSync =
                    log.action === "sync" && pullDetails && pushDetails;

                  return {
                    key: log.id.toString(),
                    label: (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "4px 0",
                        }}
                      >
                        {getActionIcon()}
                        <Text strong style={{ fontSize: 13 }}>
                          {log.action.toUpperCase()}
                        </Text>
                        <Tag color={getActionColor()} style={{ fontSize: 10 }}>
                          {log.status.toUpperCase()}
                        </Tag>
                        {isBidirectionalSync && (
                          <>
                            {pullDetails && (
                              <Tag color="blue" style={{ fontSize: 10 }}>
                                Pull
                              </Tag>
                            )}
                            {pushDetails && (
                              <Tag color="blue" style={{ fontSize: 10 }}>
                                Push
                              </Tag>
                            )}
                          </>
                        )}
                        {!isBidirectionalSync && details?.type && (
                          <Tag color="blue" style={{ fontSize: 10 }}>
                            {details.type === "pull" ? "Pull" : "Push"}
                          </Tag>
                        )}
                        {details?.strategy && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {details.strategy}
                          </Text>
                        )}
                        <Text
                          type="secondary"
                          style={{ fontSize: 10, marginLeft: "auto" }}
                        >
                          {new Date(log.timestamp).toLocaleString()}
                        </Text>
                      </div>
                    ),
                    children: (
                      <div style={{ padding: "8px 0", paddingLeft: 24 }}>
                        {details?.message && (
                          <Text
                            type="secondary"
                            style={{
                              fontSize: 11,
                              display: "block",
                              marginBottom: 8,
                            }}
                          >
                            {details.message}
                          </Text>
                        )}

                        {/* Pull Details */}
                        {pullDetails && (
                          <div style={{ marginBottom: 16 }}>
                            <Text
                              strong
                              style={{
                                fontSize: 12,
                                marginBottom: 8,
                                display: "block",
                              }}
                            >
                              Pull from Server:
                            </Text>
                            {(pullDetails.downloadedImages &&
                              pullDetails.downloadedImages.length > 0) ||
                            (pullDetails.updatedImages &&
                              pullDetails.updatedImages.length > 0) ||
                            (pullDetails.deletedImages &&
                              pullDetails.deletedImages.length > 0) ? (
                              <>
                                {pullDetails.downloadedImages?.length > 0 && (
                                  <div style={{ marginBottom: 8 }}>
                                    <Text
                                      type="secondary"
                                      style={{
                                        fontSize: 11,
                                        marginBottom: 4,
                                        display: "block",
                                      }}
                                    >
                                      Downloaded (
                                      {pullDetails.downloadedImages.length}):
                                    </Text>
                                    <List
                                      size="small"
                                      dataSource={pullDetails.downloadedImages}
                                      renderItem={(filename: string) => (
                                        <List.Item
                                          style={{
                                            padding: "4px 12px",
                                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              width: "100%",
                                            }}
                                          >
                                            <CloudDownloadOutlined
                                              style={{
                                                color: token.colorSuccess,
                                              }}
                                            />
                                            <Text style={{ fontSize: 11 }}>
                                              {filename}
                                            </Text>
                                          </div>
                                        </List.Item>
                                      )}
                                    />
                                  </div>
                                )}
                                {pullDetails.updatedImages?.length > 0 && (
                                  <div style={{ marginBottom: 8 }}>
                                    <Text
                                      type="secondary"
                                      style={{
                                        fontSize: 11,
                                        marginBottom: 4,
                                        display: "block",
                                      }}
                                    >
                                      Updated (
                                      {pullDetails.updatedImages.length}):
                                    </Text>
                                    <List
                                      size="small"
                                      dataSource={pullDetails.updatedImages}
                                      renderItem={(filename: string) => (
                                        <List.Item
                                          style={{
                                            padding: "4px 12px",
                                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              width: "100%",
                                            }}
                                          >
                                            <SyncOutlined
                                              style={{ color: token.colorInfo }}
                                            />
                                            <Text style={{ fontSize: 11 }}>
                                              {filename}
                                            </Text>
                                          </div>
                                        </List.Item>
                                      )}
                                    />
                                  </div>
                                )}
                                {pullDetails.deletedImages?.length > 0 && (
                                  <div style={{ marginBottom: 8 }}>
                                    <Text
                                      type="secondary"
                                      style={{
                                        fontSize: 11,
                                        marginBottom: 4,
                                        display: "block",
                                      }}
                                    >
                                      Deleted Locally (
                                      {pullDetails.deletedImages.length}):
                                    </Text>
                                    <List
                                      size="small"
                                      dataSource={pullDetails.deletedImages}
                                      renderItem={(filename: string) => (
                                        <List.Item
                                          style={{
                                            padding: "4px 12px",
                                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              width: "100%",
                                            }}
                                          >
                                            <DeleteOutlined
                                              style={{
                                                color: token.colorError,
                                              }}
                                            />
                                            <Text style={{ fontSize: 11 }}>
                                              {filename}
                                            </Text>
                                          </div>
                                        </List.Item>
                                      )}
                                    />
                                  </div>
                                )}
                              </>
                            ) : (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                No changes
                              </Text>
                            )}
                          </div>
                        )}

                        {/* Push Details */}
                        {pushDetails && (
                          <div style={pullDetails ? {} : { marginBottom: 16 }}>
                            {!pullDetails && (
                              <Text
                                strong
                                style={{
                                  fontSize: 12,
                                  marginBottom: 8,
                                  display: "block",
                                }}
                              >
                                Push to Server:
                              </Text>
                            )}
                            {pullDetails && (
                              <Text
                                strong
                                style={{
                                  fontSize: 12,
                                  marginBottom: 8,
                                  display: "block",
                                }}
                              >
                                Push to Server:
                              </Text>
                            )}
                            {(pushDetails.uploadedImages &&
                              pushDetails.uploadedImages.length > 0) ||
                            (pushDetails.updatedImages &&
                              pushDetails.updatedImages.length > 0) ||
                            (pushDetails.deletedImages &&
                              pushDetails.deletedImages.length > 0) ? (
                              <>
                                {pushDetails.uploadedImages?.length > 0 && (
                                  <div style={{ marginBottom: 8 }}>
                                    <Text
                                      type="secondary"
                                      style={{
                                        fontSize: 11,
                                        marginBottom: 4,
                                        display: "block",
                                      }}
                                    >
                                      Uploaded (
                                      {pushDetails.uploadedImages.length}
                                      ):
                                    </Text>
                                    <List
                                      size="small"
                                      dataSource={pushDetails.uploadedImages}
                                      renderItem={(filename: string) => (
                                        <List.Item
                                          style={{
                                            padding: "4px 12px",
                                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              width: "100%",
                                            }}
                                          >
                                            <CloudUploadOutlined
                                              style={{
                                                color: token.colorSuccess,
                                              }}
                                            />
                                            <Text style={{ fontSize: 11 }}>
                                              {filename}
                                            </Text>
                                          </div>
                                        </List.Item>
                                      )}
                                    />
                                  </div>
                                )}
                                {pushDetails.updatedImages?.length > 0 && (
                                  <div style={{ marginBottom: 8 }}>
                                    <Text
                                      type="secondary"
                                      style={{
                                        fontSize: 11,
                                        marginBottom: 4,
                                        display: "block",
                                      }}
                                    >
                                      Updated (
                                      {pushDetails.updatedImages.length}):
                                    </Text>
                                    <List
                                      size="small"
                                      dataSource={pushDetails.updatedImages}
                                      renderItem={(filename: string) => (
                                        <List.Item
                                          style={{
                                            padding: "4px 12px",
                                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              width: "100%",
                                            }}
                                          >
                                            <SyncOutlined
                                              style={{ color: token.colorInfo }}
                                            />
                                            <Text style={{ fontSize: 11 }}>
                                              {filename}
                                            </Text>
                                          </div>
                                        </List.Item>
                                      )}
                                    />
                                  </div>
                                )}
                                {pushDetails.deletedImages?.length > 0 && (
                                  <div style={{ marginBottom: 8 }}>
                                    <Text
                                      type="secondary"
                                      style={{
                                        fontSize: 11,
                                        marginBottom: 4,
                                        display: "block",
                                      }}
                                    >
                                      Deleted from Server (
                                      {pushDetails.deletedImages.length}):
                                    </Text>
                                    <List
                                      size="small"
                                      dataSource={pushDetails.deletedImages}
                                      renderItem={(filename: string) => (
                                        <List.Item
                                          style={{
                                            padding: "4px 12px",
                                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              width: "100%",
                                            }}
                                          >
                                            <DeleteOutlined
                                              style={{
                                                color: token.colorError,
                                              }}
                                            />
                                            <Text style={{ fontSize: 11 }}>
                                              {filename}
                                            </Text>
                                          </div>
                                        </List.Item>
                                      )}
                                    />
                                  </div>
                                )}
                              </>
                            ) : (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                No changes
                              </Text>
                            )}
                          </div>
                        )}

                        {details?.conflictDetails &&
                          details.conflictDetails.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <Text
                                type="secondary"
                                style={{
                                  fontSize: 11,
                                  marginBottom: 4,
                                  display: "block",
                                }}
                              >
                                Conflicts ({details.conflictsResolved || 0}):
                              </Text>
                              <List
                                size="small"
                                dataSource={details.conflictDetails}
                                renderItem={(conflict: any) => (
                                  <List.Item
                                    style={{
                                      padding: "4px 12px",
                                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        width: "100%",
                                      }}
                                    >
                                      <WarningOutlined
                                        style={{ color: token.colorWarning }}
                                      />
                                      <Text style={{ fontSize: 11 }}>
                                        {conflict.filename}
                                      </Text>
                                      <Tag
                                        color="warning"
                                        style={{ fontSize: 9 }}
                                      >
                                        {conflict.resolution}
                                      </Tag>
                                    </div>
                                  </List.Item>
                                )}
                              />
                            </div>
                          )}

                        {!pullDetails &&
                          !pushDetails &&
                          !details?.downloadedImages?.length &&
                          !details?.uploadedImages?.length &&
                          !details?.updatedImages?.length &&
                          !details?.deletedImages?.length &&
                          !details?.conflictDetails?.length && (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="No detailed information"
                              style={{ margin: "10px 0" }}
                              imageStyle={{ height: 40 }}
                            />
                          )}
                      </div>
                    ),
                  };
                })}
              />
              );
            })()}
          </Card>
        </Col>
      </Row>

      {/* Image Selection Modal */}
      <Modal
        title="Select Images to Download"
        open={isImageSelectionVisible}
        onOk={handleConfirmDownload}
        onCancel={() => {
          setIsImageSelectionVisible(false);
          setSelectedImageIds([]);
        }}
        width={900}
        okText="Download Selected"
        cancelText="Cancel"
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button
              size="small"
              onClick={() => setSelectedImageIds(images.map((img) => img.id))}
            >
              Select All
            </Button>
            <Button size="small" onClick={() => setSelectedImageIds([])}>
              Deselect All
            </Button>
            <span style={{ marginLeft: 16, fontWeight: 500 }}>
              Selected:{" "}
              <span style={{ color: token.colorPrimary }}>
                {selectedImageIds.length}
              </span>{" "}
              / {images.length}
            </span>
          </Space>
        </div>

        <div
          style={{
            maxHeight: 500,
            overflowY: "auto",
            border: `1px solid ${token.colorBorder}`,
            borderRadius: token.borderRadius,
          }}
        >
          {(() => {
            const grouped = images.reduce((acc, img) => {
              const key = (img as any).folderId?.toString() || "root";
              if (!acc[key]) acc[key] = [];
              acc[key].push(img);
              return acc;
            }, {} as Record<string, typeof images>);

            return Object.entries(grouped).map(([folderId, folderImages]) => {
              const folderName =
                folderId === "root"
                  ? "Sample Images"
                  : folders.find((f) => f.id === parseInt(folderId))?.name ||
                    "Unknown";

              return (
                <div key={folderId}>
                  <div
                    style={{
                      padding: "8px 16px",
                      background: token.colorBgTextHover,
                      fontWeight: 600,
                      borderBottom: `1px solid ${token.colorBorder}`,
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                    onClick={() => {
                      const newExpanded = new Set(expandedFolders);
                      if (newExpanded.has(folderId)) {
                        newExpanded.delete(folderId);
                      } else {
                        newExpanded.add(folderId);
                      }
                      setExpandedFolders(newExpanded);
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <FolderOutlined style={{ marginRight: 8 }} />
                      {folderName} ({folderImages.length})
                    </div>
                    {expandedFolders.has(folderId) ? (
                      <DownOutlined />
                    ) : (
                      <RightOutlined />
                    )}
                  </div>
                  {expandedFolders.has(folderId) &&
                    folderImages.map((image) => (
                      <div
                        key={image.id}
                        style={{
                          padding: "12px 16px",
                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                          background: selectedImageIds.includes(image.id)
                            ? token.colorPrimaryBg
                            : "transparent",
                          transition: "all 0.2s ease",
                          borderLeft: selectedImageIds.includes(image.id)
                            ? `3px solid ${token.colorPrimary}`
                            : "3px solid transparent",
                        }}
                        onClick={() => {
                          if (selectedImageIds.includes(image.id)) {
                            setSelectedImageIds(
                              selectedImageIds.filter((id) => id !== image.id)
                            );
                          } else {
                            setSelectedImageIds([
                              ...selectedImageIds,
                              image.id,
                            ]);
                          }
                        }}
                      >
                        <Checkbox
                          checked={selectedImageIds.includes(image.id)}
                          style={{ marginRight: 12 }}
                        />
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            marginRight: 16,
                            borderRadius: token.borderRadius,
                            overflow: "hidden",
                            border: `2px solid ${
                              selectedImageIds.includes(image.id)
                                ? token.colorPrimary
                                : token.colorBorder
                            }`,
                            transition: "all 0.2s ease",
                          }}
                        >
                          <img
                            src={`http://localhost:3000/api/images/${image.id}/thumbnail`}
                            alt={image.filename}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, marginBottom: 4 }}>
                            {image.originalName}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: token.colorTextSecondary,
                            }}
                          >
                            <Tag color="blue" style={{ marginRight: 8 }}>
                              {image.format?.toUpperCase()}
                            </Tag>
                            {(parseInt(image.fileSize) / 1024 / 1024).toFixed(
                              2
                            )}{" "}
                            MB
                          </div>
                        </div>
                        {selectedImageIds.includes(image.id) && (
                          <CheckCircleOutlined
                            style={{ fontSize: 24, color: token.colorPrimary }}
                          />
                        )}
                      </div>
                    ))}
                </div>
              );
            });
          })()}
        </div>

        {downloadPath && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: token.colorInfoBg,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorInfoBorder}`,
            }}
          >
            <strong>Download to:</strong> {downloadPath}
          </div>
        )}
      </Modal>
    </Content>
  );
};

export default SyncPanel;
