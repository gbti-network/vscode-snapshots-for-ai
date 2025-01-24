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

        // Find the VSIX file
        const files = fs.readdirSync('.');
        const vsixFile = files.find(file => file.endsWith('.vsix'));
        if (!vsixFile) {
            throw new Error('No VSIX file found in directory');
        }

        // Create GitHub release with changelog content and VSIX file
        console.log('Release notes:', changelogContent);
        const releaseData = {
            tag_name: tag,
            name: `Release ${tag}`,
            body: changelogContent || `Release ${tag} - No changelog content available`,
            draft: false,
            prerelease: false
        };

        // Write JSON data to a temporary file
        const tempFile = path.join(__dirname, 'release-data.json');
        fs.writeFileSync(tempFile, JSON.stringify(releaseData));

        try {
            // Create the release first
            const createReleaseCommand = `curl -X POST -H "Authorization: token ${process.env.GITHUB_TOKEN}" -H "Content-Type: application/json" -d "@${tempFile}" https://api.github.com/repos/gbti-network/vscode-snapshots-for-ai/releases`;
            const response = await execAsync(createReleaseCommand);
            const releaseResponse = JSON.parse(response.stdout);
            
            if (!releaseResponse || !releaseResponse.upload_url) {
                throw new Error('Invalid response from GitHub API: ' + response.stdout);
            }

            // Clean up the temporary file
            fs.unlinkSync(tempFile);

            // Upload the asset to the release
            const uploadUrl = releaseResponse.upload_url.replace(/{.*}/, '');
            const uploadCommand = `curl -X POST -H "Authorization: token ${process.env.GITHUB_TOKEN}" -H "Content-Type: application/octet-stream" --data-binary "@${vsixFile}" "${uploadUrl}?name=${vsixFile}"`;
            await execAsync(uploadCommand);

            console.log('Created GitHub release with VSIX file attached');
            console.log(`GitHub release ${tag} created successfully!`);
        } catch (error: any) {
            console.error('GitHub API Error:', error);
            if (error?.stdout) {
                console.error('Response:', error.stdout);
            }
            throw new Error('Failed to create GitHub release: ' + (error?.message || 'Unknown error'));
        } finally {
            // Ensure temp file is cleaned up even if there's an error
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
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
    
    // Get current version from package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;
    
    // Set VSCE_PAT environment variable for the package command
    const env = { ...process.env };
    if (process.env.VSCE_PAT) {
        env.VSCE_PAT = process.env.VSCE_PAT;
    }
    
    // Force clean any existing VSIX files
    const vsixFiles = fs.readdirSync(path.join(__dirname, '..')).filter(file => file.endsWith('.vsix'));
    for (const file of vsixFiles) {
        fs.unlinkSync(path.join(__dirname, '..', file));
    }
    
    // Package with explicit version
    await execAsync(`npx vsce package ${version}`, { env });
    console.log(`Packaged version ${version}`);
    
    // Verify the VSIX file exists with correct version
    const expectedVsix = `snapshots-for-ai-${version}.vsix`;
    const vsixPath = path.join(__dirname, '..', expectedVsix);
    if (!fs.existsSync(vsixPath)) {
        throw new Error(`Failed to create VSIX file: ${expectedVsix}`);
    }
}

async function publishExtension() {
    console.log('Publishing to VS Code Marketplace...');
    
    // Get current version
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;
    
    // Set VSCE_PAT environment variable for the publish command
    const env = { ...process.env };
    if (process.env.VSCE_PAT) {
        env.VSCE_PAT = process.env.VSCE_PAT;
    } else {
        throw new Error('VSCE_PAT environment variable is required for publishing');
    }
    
    try {
        const result = await execAsync('npx vsce publish', { env });
        console.log('VS Code Marketplace publish output:', result.stdout);
        
        // Verify the publish was successful
        if (!result.stdout.includes('Published') && !result.stdout.includes('success')) {
            throw new Error('VS Code Marketplace publish may have failed - unexpected output');
        }
        
        console.log(`Successfully published version ${version} to VS Code Marketplace`);
        console.log('Note: The extension will be reviewed by the marketplace team before it becomes available');
        console.log('You should receive an email notification when the review is complete');
    } catch (error) {
        console.error('Failed to publish to VS Code Marketplace:', error);
        throw error;
    }
}

async function publishToOpenVSX() {
    const token = process.env.OVSX_PAT;
    if (!token) {
        console.warn('OVSX_PAT not found. Skipping Open VSX Registry publish.');
        return;
    }

    // Get current version
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;

    try {
        const result = await execAsync('npx ovsx publish', {
            env: { ...process.env, OVSX_PAT: token }
        });
        console.log('Open VSX Registry publish output:', result.stdout);
        
        // Verify the publish was successful
        if (!result.stdout.includes('Published') && !result.stdout.includes('success')) {
            throw new Error('Open VSX Registry publish may have failed - unexpected output');
        }
        
        console.log(`Successfully published version ${version} to Open VSX Registry`);
        console.log('The extension should be available on Open VSX Registry shortly');
    } catch (error) {
        console.error('Failed to publish to Open VSX Registry:', error);
        throw error;
    }
}

async function deploy() {
    try {
        const versionType = process.argv[2] as 'major' | 'minor' | 'patch' || 'patch';
        const githubOnly = process.argv.includes('--github-only');

        if (!process.env.GITHUB_TOKEN) {
            throw new Error('GITHUB_TOKEN environment variable is required');
        }

        // Non-GitHub deployment requirements
        if (!githubOnly && !process.env.VSCE_PAT) {
            throw new Error('VSCE_PAT environment variable is required for full deployment');
        }

        console.log(`Starting ${githubOnly ? 'GitHub-only' : 'full'} deployment...`);

        // First, ensure package-lock is in sync with current state
        await execAsync('npm install --package-lock-only');
        
        // Get current version from package.json
        const packageJsonPath = path.join(__dirname, '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const currentVersion = packageJson.version;
        const newVersion = incrementVersion(currentVersion, versionType);

        // Clean directories first
        await cleanDirectories();

        // Update version in package.json
        packageJson.version = newVersion;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`Updated version to ${newVersion}`);

        // Update package-lock.json to match new version
        await execAsync('npm install --package-lock-only');
        
        // Verify versions are in sync
        const packageLockPath = path.join(__dirname, '..', 'package-lock.json');
        const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
        if (packageLock.version !== newVersion || packageLock.packages[''].version !== newVersion) {
            throw new Error('Version mismatch detected between package.json and package-lock.json');
        }
        
        // Install dependencies with the new versions
        await execAsync('npm install');
        console.log('Updated package-lock.json and installed dependencies');

        // Now compile and package
        await compileTypeScript();
        await packageExtension();

        // Get changelog content for the release
        const changelogContent = await getChangelogContent(newVersion);

        // Create GitHub release with VSIX attachment
        await createGitHubRelease(newVersion, changelogContent);

        if (!githubOnly) {
            // Publish to marketplaces only if not GitHub-only
            await publishExtension();
            await publishToOpenVSX();
        }

        console.log(`${githubOnly ? 'GitHub-only deployment' : 'Full deployment'} completed successfully!`);
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
