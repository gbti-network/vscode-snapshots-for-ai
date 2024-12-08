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

async function createGitHubRelease(version: string, notes: string) {
    try {
        // Create temporary release notes file
        const tempNotesPath = path.join(__dirname, 'release-notes.tmp');
        fs.writeFileSync(tempNotesPath, notes);

        try {
            // Create and push tag
            await execAsync(`git tag -a v${version} -m "Release v${version}"`);
            console.log(`Created tag v${version}`);
            
            // Add all changes
            await execAsync('git add .');
            console.log('Added changes');
            
            // Commit changes
            await execAsync(`git commit -m "Release v${version}"`);
            console.log('Committed changes');
            
            // Push changes and tags
            await execAsync('git push origin main --tags');
            console.log('Pushed changes and tags');

            // Create GitHub release using gh CLI
            await execAsync(
                `gh release create v${version} --title "Release v${version}" --notes-file "${tempNotesPath}"`,
                { 
                    env: { 
                        ...process.env,
                        GH_TOKEN: process.env.GITHUB_TOKEN 
                    }
                }
            );
            console.log('Created GitHub release');

        } finally {
            // Clean up temporary file
            if (fs.existsSync(tempNotesPath)) {
                fs.unlinkSync(tempNotesPath);
            }
        }

        console.log(`GitHub release v${version} created successfully!`);
    } catch (error) {
        console.error('Error creating GitHub release:', error);
        throw error;
    }
}

async function incrementVersion(): Promise<VersionChange> {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version.split('.').map(Number);
    const newVersion = [...currentVersion];
    
    // Determine which part to increment based on command line args
    const arg = process.argv[2] || 'patch';
    let type: 'major' | 'minor' | 'patch' = 'patch';
    
    switch (arg) {
        case 'major':
            newVersion[0]++;
            newVersion[1] = 0;
            newVersion[2] = 0;
            type = 'major';
            break;
        case 'minor':
            newVersion[1]++;
            newVersion[2] = 0;
            type = 'minor';
            break;
        default:
            newVersion[2]++;
            type = 'patch';
    }
    
    const version = newVersion.join('.');
    packageJson.version = version;
    
    // Update publisher from environment variable
    if (process.env.VSCODE_PUBLISHER_ID) {
        packageJson.publisher = process.env.VSCODE_PUBLISHER_ID;
    }
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`Incremented version to ${version} (${type})`);

    const notes = await getChangelogNotes(version);
    
    return { version, type, notes };
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
        // Validate environment variables
        if (!process.env.VSCODE_PUBLISHER_ID) {
            throw new Error('VSCODE_PUBLISHER_ID environment variable is required');
        }

        // 1. Increment version and get changelog notes
        const { version, type, notes } = await incrementVersion();

        // 2. Clean directories
        await cleanDirectories();
        console.log('Cleaned output directories');

        // 3. Install dependencies
        await installDependencies();
        console.log('Dependencies installed');

        // 4. Compile TypeScript
        await compileTypeScript();
        console.log('TypeScript compilation successful');

        // 5. Package extension
        await packageExtension();
        console.log('Extension packaged successfully');

        // 6. Create GitHub release
        await createGitHubRelease(version, notes);

        // 7. Publish if it's not a patch or if --publish flag is present
        const shouldPublish = type !== 'patch' || process.argv.includes('--publish');
        if (shouldPublish) {
            // Publish to VS Code Marketplace
            await publishExtension();
            console.log('Extension published to VS Code Marketplace');

            // Publish to Open VSX Registry (for Windfall)
            await publishToOpenVSX();
            console.log('Extension published to Open VSX Registry');
        } else {
            console.log('Patch version update - skipping publish');
        }

        console.log('Deployment completed successfully!');
    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}

// Run the deployment
deploy();
