import { ThemeConfig, theme } from 'antd';

export const darkTheme: ThemeConfig = {
    algorithm: theme.darkAlgorithm,
    token: {
        // Brand Colors
        colorPrimary: '#FFD100', // Voyis Yellow
        colorInfo: '#00A3E0',    // Tech Blue

        // Background Colors
        colorBgBase: '#00030A',      // Deep Ocean (Main Background)
        colorBgContainer: '#0B1221', // Abyss (Card/Container Background)
        colorBgElevated: '#151E32',  // Elevated Background (Dropdowns/Modals)

        // Text Colors
        colorTextBase: '#FFFFFF',
        colorTextSecondary: '#B0B8C4', // Starlight

        // Borders & Radius
        borderRadius: 8,
        wireframe: false,
        colorBorder: '#1F2937', // Horizon
        colorBorderSecondary: '#1F2937',

        // Typography
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
    components: {
        Button: {
            primaryColor: '#00030A', // Black text on yellow button for contrast
            fontWeight: 700,
            defaultBorderColor: '#FFFFFF',
            defaultColor: '#FFFFFF',
            defaultGhostColor: '#FFFFFF',
        },
        Layout: {
            headerBg: '#000000',
            bodyBg: '#00030A',
            siderBg: '#000000', // Pure Black
        },
        Card: {
            colorBgContainer: '#0B1221',
            colorBorderSecondary: '#1F2937',
        },
        Table: {
            headerBg: '#151E32',
            rowHoverBg: '#1F2937',
        },
        Menu: {
            darkItemBg: '#0B1221',
            darkItemColor: '#B0B8C4',
            darkItemSelectedBg: 'rgba(255, 209, 0, 0.15)', // Slightly stronger yellow with opacity
            darkItemSelectedColor: '#FFD100',
        }
    }
};

export const lightTheme: ThemeConfig = {
    algorithm: theme.defaultAlgorithm,
    token: {
        // Brand Colors
        colorPrimary: '#000000', // Black (was Yellow in Dark Mode)
        colorInfo: '#00A3E0',

        // Background Colors
        colorBgBase: '#E6BC00',      // Darker Yellow (was #FFD100)
        colorBgContainer: '#E6BC00', // Darker Yellow
        colorBgElevated: '#E6BC00',  // Darker Yellow

        // Text Colors
        colorTextBase: '#000000',    // Black
        colorTextSecondary: 'rgba(0, 0, 0, 0.65)', // Dark Grey

        // Borders & Radius
        borderRadius: 8,
        wireframe: false,
        colorBorder: '#000000', // Black Borders for contrast
        colorBorderSecondary: 'rgba(0, 0, 0, 0.2)',

        // Typography
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
    components: {
        Button: {
            primaryColor: '#E6BC00', // Darker Yellow text on Black button
            fontWeight: 700,
            defaultBorderColor: '#000000',
            defaultColor: '#000000',
            defaultGhostColor: '#000000',
        },
        Layout: {
            headerBg: '#E6BC00',
            bodyBg: '#E6BC00',
            siderBg: '#E6BC00',
        },
        Card: {
            colorBgContainer: '#E6BC00',
            colorBorderSecondary: '#000000',
            headerFontSize: 16,
        },
        Table: {
            headerBg: 'rgba(0, 0, 0, 0.05)',
            rowHoverBg: 'rgba(0, 0, 0, 0.05)',
            headerColor: '#000000',
            borderColor: '#000000',
        },
        Menu: {
            itemBg: '#E6BC00',
            itemColor: '#000000',
            itemSelectedBg: '#000000', // Black background for selected item
            itemSelectedColor: '#E6BC00', // Darker Yellow text for selected item
            itemHoverBg: 'rgba(0, 0, 0, 0.05)',
        },
        Modal: {
            headerBg: '#E6BC00',
            contentBg: '#E6BC00',
            footerBg: '#E6BC00',
        },
        Statistic: {
            titleFontSize: 14,
            contentFontSize: 24,
        },
        Input: {
            colorBgContainer: 'rgba(255, 255, 255, 0.2)', // Slightly transparent white for inputs to stand out
            activeBorderColor: '#000000',
            hoverBorderColor: '#000000',
        }
    }
};
