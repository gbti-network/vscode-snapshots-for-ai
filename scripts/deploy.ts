import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const execAsync = promisify(exec);

interface VersionChange {
    version: string;
    type: 'major' | 'minor' | 'patch';
    notes: string;
}

async function getChangelogNotes(version: string): Promise<string> {
    const changelogPath = path.join(__dirname, '..', '.product', 'changelog.md');
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    const versionHeader = `## [${version}]`;
    const lines = changelog.split('\n');
    let notes = '';
    let isCurrentVersion = false;

    for (const line of lines) {
        if (line.startsWith('## [')) {
            if (isCurrentVersion) {
                break;
            }
            if (line.startsWith(versionHeader)) {
                isCurrentVersion = true;
                continue;
            }
        }
        if (isCurrentVersion && line.trim()) {
            notes += line + '\n';
        }
    }

    return notes.trim();
}

async function getChangelogContent(version: string): Promise<string> {
    try {
        const changelogPath = path.join(__dirname, '..', '.product', 'changelog.md');
        console.log('Reading changelog from:', changelogPath);
        const changelogContent = fs.readFileSync(changelogPath, 'utf8');

        // Find the section for the current version
        const versionHeader = `## [${version}]`;
        console.log('Looking for version header:', versionHeader);
        
        // Split content into lines and find the section
        const lines = changelogContent.split('\n');
        let content = [];
        let isInSection = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Start capturing at the version header
            if (line === versionHeader || line.startsWith(`${versionHeader} -`)) {
                isInSection = true;
                continue;
            }
            // Stop when we hit the next version header
            else if (isInSection && line.startsWith('## [')) {
                break;
            }
            // Capture content while in the right section
            else if (isInSection && line !== '') {
                content.push(line);
            }
        }

        const result = content.join('\n');
        if (!result) {
            console.log('No content found for version', version);
            return '';
        }

        console.log('Final changelog content:', result);
        return result;
    } catch (error) {
        console.error('Error reading changelog:', error);
        return '';
    }
}

async function createGitHubRelease(version: string, changelogContent: string) {
    try {
        const tag = `v${version}`;
        console.log(`Creating tag ${tag}`);
        await execAsync(`git tag ${tag}`);
        console.log('Added changes');
        await execAsync('git add .');
        await execAsync('git commit -m "Release ' + tag + '"');
        console.log('Committed changes');
        await execAsync('git push origin main --tags');
        console.log('Pushed changes and tags');

        // Create GitHub release with changelog content
        console.log('Release notes:', changelogContent);
        const releaseData = {
            tag_name: tag,
            name: `Release ${tag}`,
            body: changelogContent || '',
            draft: false,
            prerelease: false
        };

        // Write JSON data to a temporary file
        const tempFile = path.join(__dirname, 'release-data.json');
        fs.writeFileSync(tempFile, JSON.stringify(releaseData));

        // Use the temporary file in the curl command
        const curlCommand = `curl -X POST -H "Authorization: token ${process.env.GITHUB_TOKEN}" -H "Content-Type: application/json" -d "@${tempFile}" https://api.github.com/repos/gbti-network/vscode-snapshots-for-ai/releases`;
        const response = await execAsync(curlCommand);
        
        // Clean up the temporary file
        fs.unlinkSync(tempFile);

        console.log('Curl response:', response);
        console.log('Created GitHub release');
        console.log(`GitHub release ${tag} created successfully!`);
    } catch (error) {
        console.error('Failed to create GitHub release:', error);
        throw error;
    }
}

async function getReleaseNotes(): Promise<string> {
    const changelogPath = path.join(__dirname, '..', '.product', 'changelog.md');
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    const lines = changelog.split('\n');
    let notes = '';
    let isCurrentVersion = false;

    for (const line of lines) {
        if (line.startsWith('## [')) {
            if (isCurrentVersion) {
                break;
            }
            isCurrentVersion = true;
            continue;
        }
        if (isCurrentVersion && line.trim()) {
            notes += line + '\n';
        }
    }

    return notes.trim();
}

async function cleanDirectories() {
    const outDir = path.join(__dirname, '..', 'out');
    const distDir = path.join(__dirname, '..', 'dist');
    
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true });
    }
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true });
    }
}

async function installDependencies() {
    console.log('Installing dependencies...');
    await execAsync('npm install');
}

async function compileTypeScript() {
    console.log('Compiling TypeScript...');
    const extensionTsConfig = path.join(__dirname, '..', 'tsconfig.json');
    await execAsync(`npx tsc -p "${extensionTsConfig}"`);
}

async function packageExtension() {
    console.log('Packaging extension...');
    
    // Set VSCE_PAT environment variable for the package command
    const env = { ...process.env };
    if (process.env.VSCE_PAT) {
        env.VSCE_PAT = process.env.VSCE_PAT;
    }
    
    await execAsync('npx vsce package', { env });
}

async function publishExtension() {
    console.log('Publishing extension...');
    
    // Set VSCE_PAT environment variable for the publish command
    const env = { ...process.env };
    if (process.env.VSCE_PAT) {
        env.VSCE_PAT = process.env.VSCE_PAT;
    } else {
        throw new Error('VSCE_PAT environment variable is required for publishing');
    }
    
    await execAsync('npx vsce publish', { env });
}

async function publishToOpenVSX() {
    const token = process.env.OVSX_PAT;
    if (!token) {
        console.warn('OVSX_PAT not found. Skipping Open VSX Registry publish.');
        return;
    }

    try {
        await execAsync('npx ovsx publish', {
            env: { ...process.env, OVSX_PAT: token }
        });
        console.log('Published to Open VSX Registry successfully');
    } catch (error) {
        console.error('Failed to publish to Open VSX Registry:', error);
        throw error;
    }
}

async function deploy() {
    try {
        const args = process.argv.slice(2);
        const versionType = args[0] || 'patch';
        const shouldPublish = args.includes('--publish');
        const githubOnly = args.includes('--github-only');

        if (!['major', 'minor', 'patch'].includes(versionType)) {
            console.error('Invalid version type. Use: major, minor, or patch');
            process.exit(1);
        }

        // Get current version
        const packageJsonPath = path.join(__dirname, '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const currentVersion = packageJson.version;

        // Increment version
        const newVersion = incrementVersion(currentVersion, versionType as 'major' | 'minor' | 'patch');
        console.log(`Incremented version to ${newVersion} (${versionType})`);

        // Get changelog content before updating package.json
        let changelogContent = await getChangelogContent(newVersion);
        if (!changelogContent) {
            console.log(`No changelog entry found for version ${newVersion}. Must be an oversight.`);
            changelogContent = 'Changes not documented. Must be an oversight.';
        }
        console.log('Changelog content:', changelogContent);

        // Update package.json with new version
        packageJson.version = newVersion;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

        if (!githubOnly) {
            // Clean and prepare
            console.log('Cleaned output directories');
            await cleanDirectories();

            // Install dependencies
            console.log('Installing dependencies...');
            await installDependencies();
            console.log('Dependencies installed');

            // Compile TypeScript
            console.log('Compiling TypeScript...');
            await compileTypeScript();
            console.log('TypeScript compilation successful');

            // Package extension
            console.log('Packaging extension...');
            await packageExtension();
            console.log('Extension packaged successfully');
        }

        // Create GitHub release with changelog content
        await createGitHubRelease(newVersion, changelogContent);

        if (shouldPublish && !githubOnly) {
            console.log('Publishing extension...');
            // Publish to VS Code Marketplace
            await publishExtension();
            console.log('Extension published to VS Code Marketplace');

            // Publish to Open VSX Registry
            await publishToOpenVSX();
            console.log('Extension published to Open VSX Registry');
            console.log('Published to Open VSX Registry successfully');
        }

        console.log('Deployment completed successfully!');
    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}

function incrementVersion(currentVersion: string, versionType: 'major' | 'minor' | 'patch'): string {
    const versionParts = currentVersion.split('.').map(Number);
    switch (versionType) {
        case 'major':
            versionParts[0]++;
            versionParts[1] = 0;
            versionParts[2] = 0;
            break;
        case 'minor':
            versionParts[1]++;
            versionParts[2] = 0;
            break;
        default:
            versionParts[2]++;
    }
    return versionParts.join('.');
}

// Run the deployment
deploy();
