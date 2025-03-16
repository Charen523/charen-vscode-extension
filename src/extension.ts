import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // ✅ Webview 등록
    const provider = new CharenFileCleanerViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('file-cleaner.sidebar', provider)
    );

    // ✅ 명령어 등록
    context.subscriptions.push(
        vscode.commands.registerCommand('charen-extension.openFileCleaner', () => {
            vscode.window.showInformationMessage("📂 File Cleaner 사이드바를 엽니다.");
            vscode.commands.executeCommand("file-cleaner.sidebar.focus"); // 사이드바 열기
        })
    );
}

class CharenFileCleanerViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
        };

        webviewView.webview.html = this.getWebviewContent(webviewView.webview);

        // ✅ Webview에서 메시지를 받는 리스너
        webviewView.webview.onDidReceiveMessage(async (message) => {
            console.log("📨 Received message from Webview:", message);

            if (message.command === 'charen-fileCleaner.deleteFiles') {
                this.confirmAndDeleteFiles(message.extension);
            }
        });
    }

    // ✅ 특정 확장자의 모든 파일을 하나씩 삭제 여부 확인
    private confirmAndDeleteFiles(extension: string) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            vscode.window.showErrorMessage("❌ 워크스페이스가 열려 있지 않습니다.");
            return;
        }

        fs.readdir(workspaceFolder, (err: any, files: string[]) => {
            if (err) {
                vscode.window.showErrorMessage(`❌ 파일 목록을 가져오는 중 오류 발생: ${err.message}`);
                return;
            }

            const targetFiles = files.filter(file => file.endsWith(extension));
            if (targetFiles.length === 0) {
                vscode.window.showInformationMessage(`✅ 삭제할 "${extension}" 확장자 파일이 없습니다.`);
                return;
            }

            // ✅ 모든 파일을 순차적으로 삭제 여부 확인
            this.promptDeleteNextFile(targetFiles, workspaceFolder, 0);
        });
    }

    // ✅ 하나씩 삭제 확인 후 삭제 진행
    private promptDeleteNextFile(files: string[], folderPath: string, index: number) {
        if (index >= files.length) {
            vscode.window.showInformationMessage("✅ 파일 삭제 작업이 완료되었습니다.");
            return;
        }

        const fileName = files[index];
        const filePath = path.join(folderPath, fileName);

        vscode.window.showInformationMessage(
            `🗑 파일 "${fileName}"을(를) 삭제하시겠습니까?`,
            "예", "아니오"
        ).then(selection => {
            if (selection === "예") {
                this.deleteFile(filePath, () => {
                    this.promptDeleteNextFile(files, folderPath, index + 1); // 다음 파일로 진행
                });
            } else {
                this.promptDeleteNextFile(files, folderPath, index + 1); // 다음 파일로 진행 (삭제 안 함)
            }
        });
    }

    // ✅ 개별 파일 삭제 함수
    private deleteFile(filePath: string, callback: () => void) {
        fs.unlink(filePath, (err: any) => {
            if (err) {
                vscode.window.showErrorMessage(`❌ 파일 삭제 오류: ${filePath}`);
            } else {
                vscode.window.showInformationMessage(`🗑 파일 삭제 완료: ${filePath}`);
            }
            callback(); // 다음 파일 삭제 여부 확인
        });
    }

    private getWebviewContent(webview: vscode.Webview): string {
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.html');
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));

        let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
        htmlContent = htmlContent.replace(`./style.css`, cssUri.toString());

        return htmlContent;
    }
}

export function deactivate() {}