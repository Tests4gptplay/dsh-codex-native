export declare const profile21: {
    readonly skyVersion: "0.7.21";
    readonly originalSha256: "a1eb13f38dc0214ae56d5c8b676b3740054a0818ab2bb68801b7aedc85909ded";
    readonly patchedSha256: "210502d9b2fd64f66613dddd79bfa6942eb3cbc5472c10387ab72b9279406adf";
    readonly regions: readonly [{
        readonly name: "pe-section-count";
        readonly offset: 134;
        readonly original: "0900";
        readonly patched: "0a00";
    }, {
        readonly name: "pe-size-of-code";
        readonly offset: 156;
        readonly original: "005a1200";
        readonly patched: "005c1200";
    }, {
        readonly name: "pe-size-of-image";
        readonly offset: 208;
        readonly original: "00c01700";
        readonly patched: "00d01700";
    }, {
        readonly name: "pe-checksum";
        readonly offset: 216;
        readonly original: "bcac1700";
        readonly patched: "00000000";
    }, {
        readonly name: "pe-certificate-directory";
        readonly offset: 296;
        readonly original: "00661700303d0000";
        readonly patched: "0000000000000000";
    }, {
        readonly name: "mta-section-header";
        readonly offset: 752;
        readonly original: "00000000000000000000000000000000000000000000000000000000000000000000000000000000";
        readonly patched: "2e63757731300000d000000000c01700000200000066170000000000000000000000000020000060";
    }, {
        readonly name: "mta-wrapper-and-unwind";
        readonly offset: 1533440;
        readonly original: "303d00000002020030823d2006092a864886f70d010702a0823d1130823d0d020101310f300d06096086480165030402010500305c060a2b060104018237020104a04e304c3017060a2b06010401823702010f3009030100a004a20280003031300d06096086480165030402010500042070503aca72125a22b658f96ff5e834021d800962624f27845f018eec91a8190ea0822200308205cc308203b4a00302010202105498d2d1d45b1995481379c811c08799300d06092a864886f70d01010c05003077310b3009060355040613025553311e301c060355040a13154d6963726f736f667420436f72706f726174696f6e314830460603550403133f4d6963726f736f6674204964656e7469747920566572696669636174696f6e20526f6f7420436572746966696361746520417574686f726974792032303230301e170d3230303431363138333631365a170d3435303431363138343434305a3077310b3009060355040613025553311e301c060355040a13154d6963726f736f667420436f72706f726174696f6e314830460603550403133f4d6963726f736f6674204964656e7469747920566572696669636174696f6e20526f6f7420436572746966696361746520417574686f72697479203230323030820222300d06092a864886f70d01010105000382020f003082020a0282020100b3912a07830667fd9e9d";
        readonly patched: "534883ec304889cb488b5108f00fba6a1008723a488b01ff500831c931d24c8d055b0000004989d948c74424200000000048c744242800000000ff15f8a1ffff4885c074114889c1ff15aaa1ffff31c04883c4305bc3488b4308c64011004889d9488b01ff5010b8054000804883c4305bc3cccccccccccccccccccccccccccc534883ec204889cbb901000000ff15bda0ffff4889d9e8a964ecffff15b7a0ffff4889d9488b01ff501031c04883c4205bc3cccccccccccccccccccccccccccc0105020005520130010502000532013000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    }, {
        readonly name: "frame-arrived-busy-return";
        readonly offset: 268665;
        readonly original: "0f855b310000";
        readonly patched: "0f853d310000";
    }, {
        readonly name: "frame-arrived-once-flag";
        readonly offset: 268682;
        readonly original: "740d";
        readonly patched: "eb0d";
    }, {
        readonly name: "frame-arrived-vtable";
        readonly offset: 1227592;
        readonly original: "4425044001000000";
        readonly patched: "00c0174001000000";
    }, {
        readonly name: "pe-exception-directory-size";
        readonly offset: 292;
        readonly original: "78840000";
        readonly patched: "90840000";
    }, {
        readonly name: "pdata-virtual-size";
        readonly offset: 520;
        readonly original: "78840000";
        readonly patched: "90840000";
    }, {
        readonly name: "mta-runtime-functions";
        readonly offset: 1403512;
        readonly original: "000000000000000000000000000000000000000000000000";
        readonly patched: "00c0170072c01700c0c0170080c01700b2c01700c8c01700";
    }];
    readonly bindings: readonly [{
        readonly offset: 58;
        readonly name: "CreateThread";
        readonly targetRva: 1532472;
    }, {
        readonly offset: 72;
        readonly name: "CloseHandle";
        readonly targetRva: 1532408;
    }, {
        readonly offset: 141;
        readonly name: "RoInitialize";
        readonly targetRva: 1532240;
    }, {
        readonly offset: 155;
        readonly name: "RoUninitialize";
        readonly targetRva: 1532248;
    }];
    readonly callbackRva: 271684;
    readonly vtableOffset: 1227592;
    readonly newSectionRva: 1556480;
    readonly newSectionRaw: 1533440;
    readonly referenceSource: "https://github.com/chen0416ccc-cpu/codex-windows-fast-patch-skill/blob/main/scripts/patch-computer-use-helper-win10.ps1";
    readonly adaptation: "Relocated callback, IAT targets, section layout and unwind entries for 0.7.21. Verified by DSH static checks and Windows screenshot recovery; no helper executable is distributed.";
};
