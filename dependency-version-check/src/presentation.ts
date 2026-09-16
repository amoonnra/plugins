import * as vscode from 'vscode';
import type { DependencyIssue } from './dependencyChecker';

const ISSUE_LABELS: Record<DependencyIssue['kind'], string> = {
  missing: '🔴 Not installed',
  version: '🟠 Version mismatch',
  invalid: '🟠 Invalid installed version',
  alias: '🟠 Different package installed',
};

export function projectTitle(uri: vscode.Uri): string {
  return vscode.Uri.joinPath(uri, '..').path.split('/').at(-1) || 'Project';
}

export function issueSummary(issues: readonly DependencyIssue[]): string {
  const missing = issues.filter((issue) => issue.kind === 'missing').length;
  const incompatible = issues.length - missing;
  return [
    missing > 0 ? `🔴 ${missing} missing` : '',
    incompatible > 0 ? `🟠 ${incompatible} incompatible` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function dependencyHover(
  issue: DependencyIssue,
  manifest: vscode.Uri,
  installCommand: string,
): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString('', true);
  markdown.appendMarkdown('📦 **');
  markdown.appendText(issue.dependency.name);
  markdown.appendMarkdown(`**\n\n${ISSUE_LABELS[issue.kind]}\n\n🎯 Required: **`);
  markdown.appendText(issue.dependency.required);
  markdown.appendMarkdown('**  \n📍 Installed: **');
  markdown.appendText(issue.installed ?? (issue.kind === 'missing' ? 'not installed' : 'unknown'));
  markdown.appendMarkdown('**\n\n---\n\n');
  const argumentsUri = encodeURIComponent(JSON.stringify([manifest.toString()]));
  markdown.appendMarkdown(
    `[$(cloud-download) Install dependencies](command:${installCommand}?${argumentsUri})`,
  );
  markdown.appendMarkdown('  ·  ');
  markdown.appendText(projectTitle(manifest));
  markdown.isTrusted = { enabledCommands: [installCommand] };
  return markdown;
}
