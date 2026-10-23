/** Layout only. Every visual color/radius comes from the DSH theme; controls are official primitives. */
export declare const ui: {
    section: {
        display: "flex";
        flexDirection: "column";
        gap: number;
        minWidth: number;
        color: "var(--dsw-alias-label-primary)";
    };
    card: {
        border: string;
        borderRadius: string;
        padding: number;
        minWidth: number;
    };
    toolbar: {
        display: "flex";
        alignItems: "center";
        flexWrap: "wrap";
        gap: number;
    };
    secondary: {
        color: "var(--dsw-alias-label-secondary)";
        fontSize: number;
        lineHeight: number;
    };
    note: {
        color: "var(--dsw-alias-label-tertiary)";
        fontSize: number;
        lineHeight: number;
    };
    count: {
        fontVariantNumeric: "tabular-nums";
        fontWeight: number;
        whiteSpace: "nowrap";
    };
    heading: {
        margin: number;
        fontSize: number;
        lineHeight: number;
        fontWeight: number;
    };
    link: {
        color: "inherit";
        textDecoration: string;
        textUnderlineOffset: number;
    };
};
