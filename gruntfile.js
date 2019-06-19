module.exports = function (grunt) {
    let config = require('./screeps.json');
    let branch = grunt.option('branch') || config.branch;
    let email = grunt.option('email') || config.email;
    let password = grunt.option('password') || config.password;
    let ptr = grunt.option('ptr') ? true : config.ptr;
    let publishDir = grunt.option('publishDir') || config.publishDir;

    grunt.loadNpmTasks('grunt-screeps');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-rsync');

    grunt.initConfig({
        screeps: {
            options: {
                email: email,
                password: password,
                branch: branch,
                ptr: ptr
            },
            dist: {
                src: ['dist/*.js']
            }
        },

        // Remove all files from the dist folder.
        clean: {
            'dist': ['dist/']
        },

        // Copy all source files into the dist folder, flattening the folder structure by converting path delimiters to underscores
        copy: {
            // Pushes the game code to the dist folder so it can be modified before being send to the screeps server.
            screeps: {
                files: [{
                    expand: true,
                    cwd: 'src/',
                    src: '**/*.js',
                    dest: 'dist/',
                    filter: 'isFile',
                    rename: function (dest, src) {
                        // Change the path name utilize underscores for folders
                        return dest + src.replace(/\//g, '.');
                    }
                }]
            },
            publish: {
                files: [{
                    expand: true,
                    cwd: 'dist/',
                    src: ['**/*.js'],
                    dest: publishDir,
                    filter: 'isFile',
                    rename: function (dest, src) {
                        // Change the path name. utilize dots for folders
                        return dest + src.replace(/\//g, '.');
                    }
                }]
            },
            rsync: {
                options: {
                    args: ["--verbose"],
                    exclude: [".git*"],
                    recursive: true
                },
                private: {
                    options: {
                        src: './dist/',
                        dest: publishDir
                    }
                }
            }
        },
        rsync: {
            options: {
                args: ["--verbose", "--checksum"],
                exclude: [".git*"],
                recursive: true
            },
            private: {
                options: {
                    src: './dist/',
                    dest: publishDir
                }
            }
        }
    });

    grunt.registerTask('default',  ['clean', 'copy:screeps', 'copy:publish']);
    grunt.registerTask('test',  ['clean', 'copy:screeps', 'copy:rsync:private']);
    grunt.registerTask('private',  ['clean', 'copy:screeps', 'rsync:private']);
};
