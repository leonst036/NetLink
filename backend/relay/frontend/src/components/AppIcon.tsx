import React from 'react';
import { icons, Store } from 'lucide-react';
import { useWindowStore } from '../store/useWindowStore';

function toPascalCase(str: string): string {
    return str
        .replace(/[-_ ]+(\w)/g, (_, c) => c.toUpperCase())
        .replace(/^(\w)/, (_, c) => c.toUpperCase());
}

export interface AppIconProps {
    appId?: string;
    icon?: string;
    color?: string;
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

export default function AppIcon({
    appId,
    icon,
    color,
    size = 24,
    className,
    style
}: AppIconProps) {
    const appMetadata = useWindowStore(state => state.appMetadata);
    const meta = appId ? appMetadata[appId] : undefined;

    // 1. Resolve raw icon identifier from props or NetStore metadata
    const rawIcon = icon || meta?.icon;

    // 2. Resolve color from props or NetStore metadata
    const resolvedColor = color || meta?.color || '#38bdf8';

    // 3. If rawIcon is an image URL or relative path
    if (
        rawIcon &&
        (rawIcon.startsWith('http://') ||
            rawIcon.startsWith('https://') ||
            rawIcon.startsWith('/') ||
            rawIcon.startsWith('data:image') ||
            /\.(png|svg|jpe?g|webp|ico)(\?.*)?$/i.test(rawIcon))
    ) {
        return (
            <img
                src={rawIcon}
                alt={appId || 'app icon'}
                style={{
                    width: size,
                    height: size,
                    objectFit: 'contain',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    ...style
                }}
                className={className}
            />
        );
    }

    // 4. Resolve Lucide icon component from rawIcon
    if (rawIcon) {
        const pascal = toPascalCase(rawIcon);
        const IconComponent =
            (icons as Record<string, React.ElementType>)[pascal] ||
            (icons as Record<string, React.ElementType>)[rawIcon];

        if (IconComponent) {
            return (
                <IconComponent
                    size={size}
                    color={resolvedColor}
                    style={style}
                    className={className}
                />
            );
        }
    }

    // 5. Default fallback Store icon
    return (
        <Store
            size={size}
            color={resolvedColor}
            style={style}
            className={className}
        />
    );
}
